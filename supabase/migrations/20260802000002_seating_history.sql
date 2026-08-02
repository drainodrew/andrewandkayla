-- Undo/redo for the seating chart, shared across admin accounts.
--
-- Approach: full-state snapshots, not inverse operations.
--
-- Inverting operations sounds cheaper but is where undo bugs live. Undoing
-- "delete table 7" has to restore the object AND its seat assignments AND
-- keep the same uuid so nothing else dangles; undoing a partially-applied
-- "seat this party of 5" has to know which 3 actually landed. Every one of
-- those is a separate chance to corrupt the layout.
--
-- A snapshot is just "here is the entire floor plan". Restoring one is
-- atomic and obviously correct. The data is tiny (26 tables + ~208
-- assignments is roughly 20KB of JSON), so storing a few hundred of them
-- costs less than the bugs the clever approach would buy us.
--
-- History lives in Postgres rather than browser state so that undo works
-- after a refresh, and so Andrew can undo something Kayla just did.

create table seating_snapshots (
  seq bigserial primary key,

  -- { objects: [...], assignments: [...] } -- the complete floor plan
  state jsonb not null,

  -- Human-readable description of the change that PRODUCED this state,
  -- so the undo button can say "Undo: seat the Myers party at Table 3".
  label text not null,

  created_by text,
  created_at timestamptz not null default now()
);

create index idx_seating_snapshots_seq on seating_snapshots (seq desc);

-- Singleton row holding the undo cursor. `id` is constrained to true so a
-- second row is impossible; this is the standard trick for a config table
-- that must have exactly one row.
create table seating_history_pointer (
  id boolean primary key default true check (id = true),

  -- Which snapshot the live floor plan currently matches. Undo steps this
  -- back, redo steps it forward, and a new edit truncates everything after
  -- it (the standard undo-stack semantics: branching from the middle of
  -- history discards the abandoned future).
  current_seq bigint references seating_snapshots (seq) on delete set null,

  updated_at timestamptz not null default now()
);

insert into seating_history_pointer (id, current_seq) values (true, null);

-- Admin-only, same as the rest of the seating tables: RLS on, no policies,
-- reached only through server actions on the service role.
alter table seating_snapshots enable row level security;
alter table seating_history_pointer enable row level security;
