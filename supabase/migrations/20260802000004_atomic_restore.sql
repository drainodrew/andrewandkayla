-- Make undo/redo restore atomic.
--
-- The bug this fixes: restoring a snapshot deleted every floor_plan_object and
-- then inserted the snapshot's rows as two separate PostgREST round trips.
-- Nothing tied them together, so any failure in the gap (network blip, a
-- deploy mid-request, a constraint error on one row) left the floor plan
-- EMPTY with the history pointer still on the old entry. That is not a
-- hypothetical: the live plan was found with 0 tables while the pointer
-- claimed 23, which is exactly this shape.
--
-- supabase-js cannot hold a transaction across calls, so the whole restore
-- has to happen inside the database, where it commits or rolls back as one
-- unit. A failure now leaves the previous layout untouched.

create or replace function restore_floor_plan(snapshot jsonb)
returns void
language plpgsql
as $$
begin
  -- Deleting objects cascades to seat_assignments.
  delete from floor_plan_objects;

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

-- Callable only by the service role, same as every other seating write.
revoke all on function restore_floor_plan(jsonb) from public, anon, authenticated;
