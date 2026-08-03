-- Collapse snapshot capture from ~7 database round trips into 1.
--
-- Every seating edit was costing 2-5 seconds, and essentially all of it was
-- latency rather than work: the app made ~16 sequential calls to Supabase per
-- click, each paying full network round-trip cost. Capturing a history
-- snapshot was the worst offender, doing read-pointer, delete-future,
-- read-objects, read-assignments, insert, update-pointer, and a prune scan as
-- separate queries.
--
-- All of it is set-based work the database can do in one statement block, so
-- it belongs here rather than being orchestrated over the wire.

-- Seed the baseline history entry if none exists, so the first edit has
-- something to undo back to. Must run BEFORE a mutation, since it captures
-- the pre-change state.
create or replace function ensure_seating_baseline(p_created_by text)
returns void
language plpgsql
as $$
declare
  new_seq bigint;
begin
  if exists (select 1 from seating_snapshots) then
    return;
  end if;

  insert into seating_snapshots (state, label, created_by)
  values (snapshot_floor_plan_state(), 'Starting layout', p_created_by)
  returning seq into new_seq;

  update seating_history_pointer
    set current_seq = new_seq, updated_at = now()
    where id;
end;
$$;

-- The floor plan as a snapshot payload. Column list must stay in sync with
-- restore_floor_plan; a column missing here is silently erased by every undo.
create or replace function snapshot_floor_plan_state()
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'objects', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', o.id, 'kind', o.kind, 'label', o.label,
        'internal_name', o.internal_name,
        'x_ft', o.x_ft, 'y_ft', o.y_ft, 'rotation_deg', o.rotation_deg,
        'seat_count', o.seat_count, 'diameter_ft', o.diameter_ft,
        'width_ft', o.width_ft, 'height_ft', o.height_ft,
        'sort_order', o.sort_order
      ) order by o.sort_order)
      from floor_plan_objects o
    ), '[]'::jsonb),
    'assignments', coalesce((
      select jsonb_agg(jsonb_build_object(
        'guest_id', a.guest_id, 'object_id', a.object_id,
        'seat_number', a.seat_number
      ))
      from seat_assignments a
    ), '[]'::jsonb)
  );
$$;

-- Record the current plan as a new history entry and return the resulting
-- undo/redo state, so the caller doesn't need a second query to refresh its
-- buttons.
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
    delete from seating_snapshots;
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

revoke all on function ensure_seating_baseline(text) from public, anon, authenticated;
revoke all on function snapshot_floor_plan_state() from public, anon, authenticated;
revoke all on function capture_seating_snapshot(text, text, int) from public, anon, authenticated;
