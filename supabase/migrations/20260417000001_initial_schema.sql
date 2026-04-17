-- Initial schema for Andrew & Kayla wedding website
-- Tables: parties, guests, events, rsvps, dietary_restrictions,
-- registry_items, registry_claim_events, admin_users

-- Custom enum types
create type rsvp_status as enum ('attending', 'declined', 'pending');
create type registry_item_status as enum ('available', 'pending', 'purchased');
create type registry_claim_action as enum ('claimed', 'confirmed_purchase', 'cancelled', 'released');

-- Parties: one row per invite (couple, family, or individual)
create table parties (
  id uuid primary key default gen_random_uuid(),
  invite_name text not null,
  party_size int not null default 1,
  address_line_1 text,
  address_line_2 text,
  city text,
  state text,
  zip_code text,
  phone text,
  email text,
  notes text,
  source_tag text,
  hidden_from_search boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Guests: individual people within a party
create table guests (
  id uuid primary key default gen_random_uuid(),
  party_id uuid not null references parties(id) on delete cascade,
  first_name text not null,
  last_name text not null,
  is_placeholder boolean not null default false,
  created_at timestamptz not null default now()
);

-- Events: ceremony, reception, welcome party, etc.
create table events (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  starts_at timestamptz,
  ends_at timestamptz,
  location text,
  address text,
  dress_code text,
  description text,
  sort_order int not null default 0
);

-- RSVPs: one per guest per event
create table rsvps (
  id uuid primary key default gen_random_uuid(),
  guest_id uuid not null references guests(id) on delete cascade,
  event_id uuid not null references events(id) on delete cascade,
  status rsvp_status not null default 'pending',
  responded_at timestamptz,
  unique (guest_id, event_id)
);

-- Dietary restrictions: one per guest
create table dietary_restrictions (
  id uuid primary key default gen_random_uuid(),
  guest_id uuid not null references guests(id) on delete cascade unique,
  notes text not null
);

-- Registry items
create table registry_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  price_cents int,
  merchant_name text,
  merchant_url text,
  image_url text,
  status registry_item_status not null default 'available',
  claimed_by_party_id uuid references parties(id) on delete set null,
  claimed_at timestamptz,
  purchased_at timestamptz,
  sort_order int not null default 0
);

-- Registry claim audit log
create table registry_claim_events (
  id uuid primary key default gen_random_uuid(),
  registry_item_id uuid not null references registry_items(id) on delete cascade,
  party_id uuid not null references parties(id) on delete cascade,
  action registry_claim_action not null,
  created_at timestamptz not null default now()
);

-- Admin users (just Andrew and Kayla)
create table admin_users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null
);

-- Index for guest search (the autocomplete lookup)
create index idx_guests_names on guests (lower(first_name), lower(last_name));
create index idx_guests_party_id on guests (party_id);

-- Index for RSVP lookups
create index idx_rsvps_guest_id on rsvps (guest_id);
create index idx_rsvps_event_id on rsvps (event_id);

-- Auto-update updated_at on parties
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger parties_updated_at
  before update on parties
  for each row
  execute function update_updated_at();
