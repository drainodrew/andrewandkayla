-- Row Level Security policies
-- Anon: read-only on events and limited registry_items
-- Authenticated admin: full access
-- Public writes go through server actions using service_role key

-- Enable RLS on all tables
alter table parties enable row level security;
alter table guests enable row level security;
alter table events enable row level security;
alter table rsvps enable row level security;
alter table dietary_restrictions enable row level security;
alter table registry_items enable row level security;
alter table registry_claim_events enable row level security;
alter table admin_users enable row level security;

-- Events: anyone can read (public schedule page)
create policy "Events are publicly readable"
  on events for select
  to anon
  using (true);

-- Registry items: anon can see items but not who claimed them.
-- The claimed_by_party_id is still in the row, but the frontend
-- should only query status and display fields. RLS can't hide
-- individual columns, so the API route / server action must
-- select only safe columns for public responses.
create policy "Registry items are publicly readable"
  on registry_items for select
  to anon
  using (true);

-- Admin policies: authenticated users whose email is in admin_users
-- get full access to everything. We check via a subquery rather than
-- a function so there's no privilege escalation if the function is
-- replaced.

create policy "Admins can read all parties"
  on parties for select to authenticated
  using (auth.email() in (select email from admin_users));

create policy "Admins can modify all parties"
  on parties for all to authenticated
  using (auth.email() in (select email from admin_users));

create policy "Admins can read all guests"
  on guests for select to authenticated
  using (auth.email() in (select email from admin_users));

create policy "Admins can modify all guests"
  on guests for all to authenticated
  using (auth.email() in (select email from admin_users));

create policy "Admins can read all events"
  on events for select to authenticated
  using (auth.email() in (select email from admin_users));

create policy "Admins can modify all events"
  on events for all to authenticated
  using (auth.email() in (select email from admin_users));

create policy "Admins can read all rsvps"
  on rsvps for select to authenticated
  using (auth.email() in (select email from admin_users));

create policy "Admins can modify all rsvps"
  on rsvps for all to authenticated
  using (auth.email() in (select email from admin_users));

create policy "Admins can read all dietary_restrictions"
  on dietary_restrictions for select to authenticated
  using (auth.email() in (select email from admin_users));

create policy "Admins can modify all dietary_restrictions"
  on dietary_restrictions for all to authenticated
  using (auth.email() in (select email from admin_users));

create policy "Admins can read all registry_items"
  on registry_items for select to authenticated
  using (auth.email() in (select email from admin_users));

create policy "Admins can modify all registry_items"
  on registry_items for all to authenticated
  using (auth.email() in (select email from admin_users));

create policy "Admins can read all registry_claim_events"
  on registry_claim_events for select to authenticated
  using (auth.email() in (select email from admin_users));

create policy "Admins can modify all registry_claim_events"
  on registry_claim_events for all to authenticated
  using (auth.email() in (select email from admin_users));

create policy "Admins can read admin_users"
  on admin_users for select to authenticated
  using (auth.email() in (select email from admin_users));
