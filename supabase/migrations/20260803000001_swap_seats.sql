-- Swap two chairs at the same table, atomically.
--
-- seat_assignments has UNIQUE (object_id, seat_number), so the obvious
-- "set A to B's seat, set B to A's seat" collides on the first statement:
-- for a moment both rows claim the same chair. Doing it as two PostgREST
-- calls would also leave a window where one guest is unseated if the second
-- call fails.
--
-- The parking spot is NULL rather than a sentinel number. seat_number is
-- nullable (it means "at this table, chair TBD") and Postgres treats NULLs as
-- distinct in a unique constraint, so parking a guest there can never
-- conflict. A sentinel like -1 would violate the seat_number >= 1 check.
--
-- Also handles the half-empty case: dragging onto an empty chair moves the
-- guest instead of swapping, which is the same operation with one side null.

create or replace function swap_seats(
  p_object_id uuid,
  p_seat_a int,
  p_seat_b int
)
returns void
language plpgsql
as $$
declare
  guest_a uuid;
  guest_b uuid;
begin
  if p_seat_a = p_seat_b then
    return;
  end if;

  select guest_id into guest_a
    from seat_assignments
    where object_id = p_object_id and seat_number = p_seat_a;

  select guest_id into guest_b
    from seat_assignments
    where object_id = p_object_id and seat_number = p_seat_b;

  -- Park A so its chair is free for B.
  if guest_a is not null then
    update seat_assignments set seat_number = null where guest_id = guest_a;
  end if;

  if guest_b is not null then
    update seat_assignments set seat_number = p_seat_a where guest_id = guest_b;
  end if;

  if guest_a is not null then
    update seat_assignments set seat_number = p_seat_b where guest_id = guest_a;
  end if;
end;
$$;

revoke all on function swap_seats(uuid, int, int) from public, anon, authenticated;
