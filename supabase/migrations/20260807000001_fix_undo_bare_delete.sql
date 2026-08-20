-- Fix undo/redo, which had never once worked in production.
--
-- Symptom: on 2026-08-07 Kayla deleted Table 24 (with 8 people seated at it)
-- and pressing Undo did nothing. The Postgres log shows exactly what happened,
-- three times, at 15:07:44, 15:08:23 and 17:36:40:
--
--   ERROR: DELETE requires a WHERE clause
--
-- Cause: Supabase preloads the pg-safeupdate extension on the `authenticator`
-- role, which is the role PostgREST connects as and therefore the role every
-- one of our server actions ultimately runs under:
--
--   authenticator -> session_preload_libraries=safeupdate
--
-- safeupdate rejects any UPDATE or DELETE with no WHERE clause. It is a good
-- guard (it is the thing that stops a typo emptying a table), but it means the
-- deliberate full wipe inside restore_floor_plan was rejected every time. The
-- restore is one transaction, so the rejection rolled the whole thing back:
-- the floor plan was left untouched and the history pointer never moved. That
-- is why the failure left no trace in seating_snapshots and went unnoticed for
-- five days. The seq column is contiguous from 220 to 419, which is proof no
-- undo ever landed: a successful undo followed by a new edit truncates the
-- redo branch and leaves a gap.
--
-- Fix: say WHERE explicitly. `where true` is not cosmetic here, it is the
-- documented way to tell safeupdate "yes, all rows, on purpose".
--
-- Two things I checked rather than assumed, by calling probe functions over
-- PostgREST as the service role (the real code path, not a psql session where
-- the extension is not even loaded):
--
--   delete from t;                    -> 400 DELETE requires a WHERE clause
--   delete from t where true;         -> 200 ok
--   set_config('safeupdate.enabled')  -> 403 permission denied to set parameter
--
-- The third line is why this migration does not simply switch the guard off
-- for the transaction, which was the first fix I reached for: that GUC is
-- superuser-only on Supabase, so the obvious approach fails in a way you would
-- only discover in production. `where true` needs no privileges.
--
-- Note that `where true` survives because safeupdate inspects the parsed query
-- for a WHERE clause, not the planned quals. The planner does constant-fold
-- `true` away, so a check against the plan would still have rejected this;
-- that it does not is verified above, not reasoned about.

-- ---------------------------------------------------------------------------
-- restore_floor_plan: the undo/redo path. Body is unchanged from
-- 20260802000004_atomic_restore.sql apart from the WHERE.
-- ---------------------------------------------------------------------------
create or replace function restore_floor_plan(snapshot jsonb)
returns void
language plpgsql
as $$
begin
  -- Deleting objects cascades to seat_assignments. `where true` is required:
  -- see the header, a bare DELETE is rejected by pg-safeupdate.
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

  -- Skip assignments whose guest has since been deleted. Without this the
  -- foreign key would abort the entire restore over one stale row.
  insert into seat_assignments (guest_id, object_id, seat_number)
  select
    (e ->> 'guest_id')::uuid,
    (e ->> 'object_id')::uuid,
    (e ->> 'seat_number')::int
  from jsonb_array_elements(coalesce(snapshot -> 'assignments', '[]'::jsonb)) e
  where exists (
    select 1 from guests g where g.id = (e ->> 'guest_id')::uuid
  );
end;
$$;

revoke all on function restore_floor_plan(jsonb) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- capture_seating_snapshot: same latent bug on the "pointer is null" branch.
-- It had not fired yet because the pointer is only null before the very first
-- baseline, but it would have taken out snapshot capture itself the moment it
-- did. Body otherwise unchanged from 20260802000006.
-- ---------------------------------------------------------------------------
create or replace function capture_seating_snapshot(
  p_label text,
  p_created_by text,
  p_max_snapshots int default 200
)
returns jsonb
language plpgsql
as $$
declare
  cur bigint;
  new_seq bigint;
  cutoff bigint;
  prev_label text;
begin
  select current_seq into cur from seating_history_pointer where id;

  -- A new edit discards the abandoned redo branch.
  if cur is not null then
    delete from seating_snapshots where seq > cur;
  else
    delete from seating_snapshots where true;
  end if;

  insert into seating_snapshots (state, label, created_by)
  values (snapshot_floor_plan_state(), p_label, p_created_by)
  returning seq into new_seq;

  update seating_history_pointer
    set current_seq = new_seq, updated_at = now()
    where id;

  -- Keep history bounded. offset/limit finds the oldest row worth keeping
  -- without scanning the whole table into the application.
  select seq into cutoff
    from seating_snapshots
    order by seq desc
    offset p_max_snapshots - 1
    limit 1;

  if cutoff is not null then
    delete from seating_snapshots where seq < cutoff;
  end if;

  -- Undo is possible when something older survives the prune.
  select label into prev_label
    from seating_snapshots
    where seq < new_seq
    order by seq desc
    limit 1;

  return jsonb_build_object(
    'canUndo', prev_label is not null,
    -- Redo is always false right after an edit: the branch was just cut.
    'canRedo', false,
    'undoLabel', case when prev_label is not null then p_label else null end,
    'redoLabel', null,
    'lastEditedBy', p_created_by,
    'lastEditedAt', now()
  );
end;
$$;

revoke all on function capture_seating_snapshot(text, text, int) from public, anon, authenticated;
