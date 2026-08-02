-- Reception seating chart: a scale floor plan of the dinner tent plus
-- per-guest seat assignments.
--
-- The tent is 50ft x 60ft and holds 60" round tables (5ft diameter).
-- The dance floor, DJ, and bar live outside the tent, so this floor plan
-- only models dinner seating: round guest tables and a head/sweetheart table.
--
-- All positions are stored in FEET, not pixels. The admin UI renders an SVG
-- whose viewBox is literally the tent in feet, so the numbers in this table
-- are real-world measurements you could hand to the rental company. Storing
-- pixels would bake in a screen size and make the data meaningless off-screen.

create table floor_plan_objects (
  id uuid primary key default gen_random_uuid(),

  -- text + check rather than a Postgres enum: adding a kind later (bar, cake
  -- table) is a one-line constraint change instead of an ALTER TYPE dance.
  kind text not null check (kind in ('round_table', 'head_table')),

  label text not null,

  -- Center point of the object, in feet from the tent's top-left corner.
  x_ft numeric(6, 2) not null,
  y_ft numeric(6, 2) not null,

  rotation_deg numeric(5, 1) not null default 0,

  -- Seats around this object. 60" rounds fit 8 comfortably; 9 is the squeeze
  -- Andrew asked for. 0 is allowed so a future non-seating fixture can reuse
  -- this table.
  seat_count int not null check (seat_count between 0 and 12) default 8,

  -- Round tables use diameter_ft. Rectangular objects (head table) use
  -- width_ft/height_ft. Only the pair relevant to `kind` is populated.
  diameter_ft numeric(5, 2),
  width_ft numeric(5, 2),
  height_ft numeric(5, 2),

  sort_order int not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Enforce that each kind carries the dimensions it actually needs, so we
  -- can never render a round table with no diameter.
  constraint floor_plan_objects_dimensions_present check (
    (kind = 'round_table' and diameter_ft is not null)
    or (kind = 'head_table' and width_ft is not null and height_ft is not null)
  )
);

create index idx_floor_plan_objects_sort on floor_plan_objects (sort_order);

create table seat_assignments (
  id uuid primary key default gen_random_uuid(),

  -- UNIQUE: a person occupies exactly one seat. Reseating someone is an
  -- update or a delete+insert, never a second row, so we can't silently
  -- double-book a guest across two tables.
  guest_id uuid not null unique references guests(id) on delete cascade,

  object_id uuid not null references floor_plan_objects(id) on delete cascade,

  -- Nullable on purpose: "at table 7, chair TBD" is a real intermediate state
  -- while Andrew and Kayla are still shuffling people around.
  seat_number int check (seat_number >= 1),

  created_at timestamptz not null default now(),

  -- Two people can't share a numbered chair. Postgres treats NULLs as
  -- distinct in a unique constraint, which is exactly what we want here:
  -- any number of guests may sit at a table with no chair chosen yet, but
  -- once a chair IS chosen it is exclusive.
  unique (object_id, seat_number)
);

create index idx_seat_assignments_object on seat_assignments (object_id);

-- RLS on with NO policies: the seating chart is admin-only. The anon key
-- gets nothing, and every read/write goes through server actions on the
-- service role, matching how party_events is locked down.
alter table floor_plan_objects enable row level security;
alter table seat_assignments enable row level security;
