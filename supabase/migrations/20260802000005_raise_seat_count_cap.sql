-- Raise the per-object seat cap from 12 to 24.
--
-- Kayla's head table seats 14, which the old ceiling rejected outright. 12
-- was a guess made when head tables only seated one side; now that seats wrap
-- the whole perimeter, a long head table for the wedding party is normal and
-- 12 is simply too low.
--
-- 24 rather than "no limit": the column still wants a sanity bound so a
-- fat-fingered 400 can't produce a table with 400 seat markers on it. At the
-- 2ft-per-seat perimeter pitch, 24 seats is a 22ft table, which is already
-- more than a third of the tent's width.
--
-- This constraint is shared with round tables, which the UI caps far lower
-- (8 or 9) on its own, so widening it here doesn't loosen anything in
-- practice for them.

alter table floor_plan_objects
  drop constraint floor_plan_objects_seat_count_check;

alter table floor_plan_objects
  add constraint floor_plan_objects_seat_count_check
  check (seat_count >= 0 and seat_count <= 24);
