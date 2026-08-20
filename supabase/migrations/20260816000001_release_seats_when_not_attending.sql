-- Fix "That seat is already taken" on a seat the UI shows as empty.
--
-- Symptom: Table 11 rendered 4/8 filled with seats 5-8 listed as "Empty", but
-- clicking a guest to seat them returned "That seat is already taken."
--
-- Cause: a guest who is seated and then DECLINES keeps their seat_assignments
-- row. The seating page deliberately hides those rows:
--
--     app/admin/(dashboard)/seating/page.tsx
--     const assignments = (...).filter((a) => attendingIds.has(a.guest_id));
--
-- so the browser never learns the chair is occupied and renders it empty. The
-- database still has the row, and `unique (object_id, seat_number)` plus the
-- occupancy check in assignSeat still see it. The UI and the database were
-- telling two different stories about the same chair, and the database wins.
--
-- Table 11 was holding three of them: Sarah Davis (seat 5), AnnaClaire
-- Schenkel (seat 6) and Eric Davis (seat 8), all declined. Seat 7 was the only
-- genuinely free chair, which is why the table looked half empty but refused
-- every guest: the "first free seat" logic runs on the client's filtered view
-- and always picked 5.
--
-- Fix, in three parts, because the phantom rows were only the visible half:
--
--   1. A trigger, so declining releases the chair at the source. This is the
--      real fix. Both write paths (the public RSVP form and the admin's
--      setGuestRsvp) are plain SQL against `rsvps`, so a trigger catches both
--      and anything added later, which application-side cleanup would not.
--
--   2. A one-time cleanup of the 7 rows that already exist.
--
--   3. restore_floor_plan learns the same rule. Snapshots taken before this
--      migration still contain the phantom assignments, so without this an
--      undo would happily put them back and reopen the bug.
--
-- Deliberately NOT done: making the page render declined guests in their
-- seats. CLAUDE.md is explicit that the seating list only shows attending
-- guests, and honouring a chair for someone who is not coming is the wrong
-- outcome anyway. The right invariant is that the row should not exist.

-- ---------------------------------------------------------------------------
-- 1. Releasing the seat when a guest stops attending.
-- ---------------------------------------------------------------------------

create or replace function release_seat_when_not_attending()
returns trigger
language plpgsql
-- SECURITY DEFINER so this holds no matter which role changes the RSVP.
-- seat_assignments has RLS enabled with no policies, and the guest-facing
-- RSVP path must not be able to fail on a permission error while writing a
-- table it does not otherwise touch.
security definer
-- Pinned search_path: standard hardening for SECURITY DEFINER, so the
-- function can't be redirected to a shadowing table by a caller's path.
set search_path = public, pg_temp
as $$
declare
  target_guest uuid;
  target_event uuid;
  is_attending boolean;
begin
  if tg_op = 'DELETE' then
    target_guest := old.guest_id;
    target_event := old.event_id;
    is_attending := false; -- no RSVP row at all is not attending
  else
    target_guest := new.guest_id;
    target_event := new.event_id;
    is_attending := new.status = 'attending';
  end if;

  if is_attending then
    return coalesce(new, old);
  end if;

  -- Only the wedding has a seating chart. Someone declining the rehearsal
  -- dinner must not lose their reception chair, which is the bug this guard
  -- exists to prevent.
  if not exists (
    select 1 from events e
    where e.id = target_event and e.slug like '%wedding%'
  ) then
    return coalesce(new, old);
  end if;

  delete from seat_assignments where guest_id = target_guest;

  return coalesce(new, old);
end;
$$;

revoke all on function release_seat_when_not_attending() from public, anon, authenticated;

drop trigger if exists trg_release_seat_when_not_attending on rsvps;

-- UPDATE OF status rather than plain UPDATE: re-saving an RSVP that hasn't
-- changed (the guest form upserts every row on every submit) shouldn't do
-- pointless delete work.
create trigger trg_release_seat_when_not_attending
after insert or delete or update of status on rsvps
for each row
execute function release_seat_when_not_attending();

-- ---------------------------------------------------------------------------
-- 2. The rows that already leaked, recorded here so this is reversible.
--
--    Table 11 seat 5  Sarah Davis          (declined)
--    Table 11 seat 6  AnnaClaire Schenkel  (declined)
--    Table 11 seat 8  Eric Davis           (declined)
--    Table 18 seat 8  Knox Myers           (declined)
--    Table 20 seat 7  Xander Spears        (declined)
--    Table 20 seat 8  Sarah Watson         (declined)
--    Table 25 seat 3  Abigale O'Boyle      (declined)
--
--    Matched by RSVP status rather than by the ids above, so this stays
--    correct if anything changed between writing and running it.
-- ---------------------------------------------------------------------------

delete from seat_assignments a
using guests g
left join rsvps r
  on r.guest_id = g.id
 and r.event_id = (select id from events where slug like '%wedding%' limit 1)
where a.guest_id = g.id
  and (r.status is null or r.status <> 'attending');

-- ---------------------------------------------------------------------------
-- 3. Undo must not resurrect them.
--
-- Body is unchanged from 20260807000001 apart from the added attending check
-- on the assignments insert. The `where true` on the delete is still load
-- bearing: see that migration for the pg-safeupdate explanation.
-- ---------------------------------------------------------------------------

create or replace function restore_floor_plan(snapshot jsonb)
returns void
language plpgsql
as $$
begin
  delete from floor_plan_objects where true;

  insert into floor_plan_objects (
    id, kind, label, internal_name, x_ft, y_ft, rotation_deg,
    seat_count, diameter_ft, width_ft, height_ft, sort_order
  )
  select
    (e ->> 'id')::uuid,
    e ->> 'kind',
    e ->> 'label',
    e ->> 'internal_name',
    (e ->> 'x_ft')::numeric,
    (e ->> 'y_ft')::numeric,
    coalesce((e ->> 'rotation_deg')::numeric, 0),
    (e ->> 'seat_count')::int,
    (e ->> 'diameter_ft')::numeric,
    (e ->> 'width_ft')::numeric,
    (e ->> 'height_ft')::numeric,
    coalesce((e ->> 'sort_order')::int, 0)
  from jsonb_array_elements(coalesce(snapshot -> 'objects', '[]'::jsonb)) e;

  insert into seat_assignments (guest_id, object_id, seat_number)
  select
    (e ->> 'guest_id')::uuid,
    (e ->> 'object_id')::uuid,
    (e ->> 'seat_number')::int
  from jsonb_array_elements(coalesce(snapshot -> 'assignments', '[]'::jsonb)) e
  -- Skip guests deleted since the snapshot: the foreign key would otherwise
  -- abort the whole restore over one stale row.
  where exists (
    select 1 from guests g where g.id = (e ->> 'guest_id')::uuid
  )
  -- Skip guests who have since stopped attending. Snapshots predating this
  -- migration still carry their assignments, and re-inserting one would put a
  -- chair back into the state the UI renders as empty and the database
  -- refuses to fill.
  and exists (
    select 1 from rsvps r
    where r.guest_id = (e ->> 'guest_id')::uuid
      and r.event_id = (select id from events where slug like '%wedding%' limit 1)
      and r.status = 'attending'
  );
end;
$$;

revoke all on function restore_floor_plan(jsonb) from public, anon, authenticated;
