-- Junction table: which parties are invited to which events.
-- If a party has no row for an event, they are NOT invited to it.
-- The wedding event is universal (all parties), so we skip inserting
-- rows for it and treat "no party_events row" as "invited to wedding only."
-- Rehearsal dinner and game day get explicit rows.

create table party_events (
  id uuid primary key default gen_random_uuid(),
  party_id uuid not null references parties(id) on delete cascade,
  event_id uuid not null references events(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (party_id, event_id)
);

create index idx_party_events_party on party_events (party_id);
create index idx_party_events_event on party_events (event_id);

-- RLS: anon can't see this table, server actions use service role
alter table party_events enable row level security;
