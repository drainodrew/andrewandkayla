# Andrew & Kayla Wedding Website

Personal wedding website for Andrew Manuel and Kayla Wegner.
Wedding: Saturday, August 29, 2026 at Belle Meade Mansion, Nashville TN.
Live at: andrewandkayla.com

## Who You're Building For

Andrew (GitHub: drainodrew) is the primary operator. Kayla will edit copy
and content. Neither is a full-time software engineer. Andrew builds
custom software with you regularly and wants to understand the "why"
behind decisions, especially in CS, systems design, and security. Do not
hand-wave. When you make a non-obvious choice, name it in a comment or
commit message.

When there is a fork between "fast" and "correct," pick correct and
explain the tradeoff. Andrew would rather debug less later than ship a
hack now.

## Project Status

v1 scope (ship first):

- Public pages: Home, RSVP, Schedule, Lodging & Travel, Things To Do,
  FAQ, Registry
- Guest-lookup RSVP flow (party-based autocomplete, server-side only)
- Admin dashboard behind Supabase Auth for Andrew and Kayla
- Registry with "intent + confirmation modal" flow
- Responsive mobile-first, tested at 375/390/768/1280/1920 px

v2 (after v1 is live):

- Supabase -> GoHighLevel webhook for CRM sync
- GHL handles its own sync to Google Sheets via native workflow
- Email notification to Andrew and Kayla on RSVP submit

NOT in scope:

- Creating user accounts for guests (they never log in)
- Public-facing guest list or addresses
- Real affiliate tracking for registry purchases (see architecture note)

## Tech Stack

- Next.js 15 (App Router, TypeScript, Server Actions)
- Tailwind CSS with shadcn/ui-style CSS variables
- Supabase: Postgres + Auth + Row Level Security
- Vercel hosting
- Node 20+

No other frameworks. No React Query, no Zustand, no tRPC. The built-in
Next.js primitives are enough for this scope. If you feel the urge to
add a dependency, stop and explain why in a comment before doing it.

## Design System

Colors (hex):

- Pink: #F8BBDB (buttons, accents, focus highlights)
- Sage green: #C5D0B3 (secondary accents, borders, tags)
- Cream: #FAF5EE (page background)
- Dark text: #2A2A2A (body text - near-black for contrast)
- Deep sage: #5C6B4E (heading text option, darker for contrast)

Fonts:

- Fraunces (Google Fonts, variable) - headings
- Inter (Google Fonts) - body, UI, inputs

The sage green (#C5D0B3) is NOT readable as body text against cream. Use
it only for borders, tags, icons, and small decorative elements. If you
want sage text anywhere, use the darker #5C6B4E.

Use pink #F8BBDB for primary buttons. Use sage for focus rings on inputs
(this was Andrew's specific request - pink focus/highlight on inputs,
sage for text accents).

Tone: playful, warm, full of love. Not stuffy. Not corporate. When
writing copy or UI strings, Andrew's voice is direct and warm; Kayla's
voice is warm and light. Avoid wedding-industrial cliches ("your special
day," "tie the knot," etc).

Do NOT use em dashes in copy. Andrew specifically prefers commas,
parentheses, or semicolons. This applies to code comments too when
writing human-facing text.

## Architecture Decisions (with reasoning)

### Guest lookup is server-side only

We never send the full guest list to the browser. The RSVP autocomplete
hits a server action that queries Supabase, returns only matching parties.

Why: 132 guests including at least one celebrity. Data shipped to the
browser is public. The dev-tools network tab shows everything that comes
down the wire. Even obfuscated, a full guest-list payload is scrapeable.

Implementation:

- Minimum 3 characters before the lookup fires
- Rate-limited: 10 queries per minute per IP (use Vercel's built-in KV
  or Upstash Redis free tier; fall back to in-memory with a warning if
  neither is configured)
- Server action returns at most 10 matches, stripped to only the fields
  the UI needs (party_id, display_name). No addresses, no emails, no
  phones ever leave the server.

### Party-based autocomplete, not person-based

Typing "andrew" returns ONE row: "Andrew Manuel & Kayla Wegner (party of
2)". Not two rows, one for Andrew and one for Kayla. Matching logic: if
any guest in a party matches the search string (on first_name,
last_name, or the full invite_name), return the whole party.

Why: matches how people think about who's invited ("we invited the
Bonds family"), and avoids the Zola pattern of showing the same couple
twice.

### Cookie-based RSVP session, not auth

After a guest selects their party, we set an HTTP-only cookie with a
signed party_id. They can come back later and their RSVP persists. They
never create an account or password.

Why: zero friction. Wedding guests are not going to sign up for an
account. Cookies let us track "who clicked buy" on registry items
without asking them to log in.

Cookie should expire Sept 30, 2026 (30 days after wedding).

### Registry uses intent + confirmation modal

Guest clicks "I want to buy this" on a registry item -> we mark it
pending_purchase with their party_id -> open merchant URL in new tab ->
when they return, modal asks "Did you buy it?" Yes marks purchased, No
releases back to available.

Why: real affiliate tracking requires merchant cooperation (webhooks,
pixels) that Amazon/Crate&Barrel do not offer for consumer wedding
registries. UTM params can track that traffic left our site but cannot
confirm a purchase. The intent + confirmation flow is honest about the
limitation and actually solves the duplicate-purchase problem, which is
the real goal.

### Admin auth via Supabase Auth magic link

Only Andrew's and Kayla's email addresses are allowlisted. No password.
Magic link to their email. Session cookie lasts 30 days.

Why: two users, both non-technical, passwords get lost. Magic link is
the lowest-friction secure option.

### v1 is Supabase-only; sync comes in v2

Do not build GoHighLevel or Google Sheets sync in v1. Ship the core
RSVP flow first, verify Kayla can use the admin dashboard, then add a
Supabase Edge Function that webhooks to GHL on rsvp insert/update. GHL
handles Sheets sync natively.

Why: sync code is hard to debug when the core flow isn't verified.
Ship v1, use it for a day, THEN layer on integrations.

## Data Model

parties

- id (uuid, pk)
- invite_name (text, e.g. "Braxton & Emily Bonds")
- party_size (int, from CSV "Count")
- address_line_1 (text, nullable)
- address_line_2 (text, nullable)
- city, state, zip_code (text, nullable)
- phone (text, nullable)
- email (text, nullable)
- notes (text, nullable) -- internal notes for Andrew/Kayla
- source_tag (text) -- which CSV stage the party came from
- hidden_from_search (bool, default false) -- for celebrity/private
- created_at, updated_at

guests

- id (uuid, pk)
- party_id (uuid, fk -> parties.id)
- first_name (text)
- last_name (text)
- is_placeholder (bool) -- true when we created a "Guest of X" row
- created_at

events

- id (uuid, pk)
- slug (text, unique) -- e.g. "friday-game-day", "wedding-day"
- name (text)
- starts_at (timestamptz)
- ends_at (timestamptz)
- location (text)
- address (text)
- dress_code (text)
- description (text)
- sort_order (int)

rsvps

- id (uuid, pk)
- guest_id (uuid, fk -> guests.id)
- event_id (uuid, fk -> events.id)
- status (enum: 'attending', 'declined', 'pending')
- responded_at (timestamptz)
- UNIQUE(guest_id, event_id)

dietary_restrictions

- id (uuid, pk)
- guest_id (uuid, fk -> guests.id, unique)
- notes (text)

registry_items

- id (uuid, pk)
- name, description, price_cents, merchant_name, merchant_url, image_url
- status (enum: 'available', 'pending', 'purchased')
- claimed_by_party_id (uuid, fk -> parties.id, nullable)
- claimed_at (timestamptz, nullable)
- purchased_at (timestamptz, nullable)
- sort_order (int)

registry_claim_events (audit log)

- id (uuid, pk)
- registry_item_id (fk)
- party_id (fk)
- action (enum: 'claimed', 'confirmed_purchase', 'cancelled', 'released')
- created_at

admin_users

- id (uuid, pk)
- email (text, unique)

## RLS Policies (Supabase)

- Anon role: SELECT on events, SELECT on registry_items (status only
  visible, not claimed_by_party_id), nothing else
- Authenticated-as-admin: full access to everything
- Server-side (service role): used only inside server actions, full access

All writes from the public site go through server actions using the
service role. The browser never has a service-role key.

## File Structure

/app
/(public)
page.tsx home
/rsvp/page.tsx lookup + RSVP flow
/schedule/page.tsx
/lodging/page.tsx
/things-to-do/page.tsx
/faq/page.tsx
/registry/page.tsx
/(admin)
/admin/layout.tsx auth guard
/admin/page.tsx dashboard
/admin/guests/page.tsx
/admin/registry/page.tsx
/api
/guest-lookup/route.ts rate-limited search endpoint
/components
/ui shadcn-style primitives
/rsvp RSVP-specific components
/admin
/lib
/supabase server and client helpers
/actions server actions (rsvp-submit, claim-item, etc.)
/rate-limit.ts
/scripts
import-guests.ts CSV -> parsed_guests_preview.csv
load-guests.ts parsed_guests_preview.csv -> Supabase
/public/images photos of Andrew and Kayla
CLAUDE.md
README.md

## Coding Conventions

- TypeScript strict mode on
- Server components by default; 'use client' only when needed for
  interactivity (forms, modals, animations)
- Server actions for all mutations; no API routes except /guest-lookup
- Tailwind classes in the order: layout, spacing, typography, color,
  effects
- No barrel files (`index.ts` re-exports) except in /components/ui
- Environment variables in .env.local, documented in .env.example
- Never commit the service_role key; it's server-only

## What to Ask Andrew Before Doing

- Before adding any dependency not already in package.json
- Before changing the data model
- Before touching files in /scripts after initial creation
- Before rewriting any copy that Andrew or Kayla has explicitly written
- Before shipping anything to production (git push to main deploys via
  Vercel)

## What You Can Do Without Asking

- Fix bugs
- Refactor for clarity
- Add types and tests
- Improve accessibility
- Optimize queries
- Update styles within the established palette

## Gotchas

- The CSV in /scripts/wedding_invite_list.csv has messy data. Some rows
  have no address. Some party names are "X & Y" (split needed). Some
  have count=2 but only one named person (create placeholder guest).
  The import script must output a human-reviewable CSV before touching
  the DB.
- Celebrity guest: one of the invitees is a celebrity. Their party
  should have hidden_from_search=true and a note explaining why.
- Supabase migrations: use the `supabase` CLI with numbered migration
  files. Do not run raw SQL in the dashboard if you can help it.
- Vercel deploys on push to `main`. Use a `staging` branch for
  in-progress work; only merge to main when Andrew has signed off.
