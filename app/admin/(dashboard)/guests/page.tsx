import { createServiceClient } from "@/lib/supabase/server";
import { GuestsTable } from "@/components/admin/guests-table";

/**
 * Type definitions for the data we pass to the client component.
 * Defined here so the server fetch and client component agree on shape.
 */
export type GuestRow = {
  id: string;
  first_name: string;
  last_name: string;
  is_placeholder: boolean;
  rsvps: {
    event_name: string;
    status: string;
  }[];
  dietary_notes: string | null;
};

export type PartyRow = {
  id: string;
  invite_name: string;
  party_size: number;
  email: string | null;
  phone: string | null;
  notes: string | null;
  guests: GuestRow[];
};

/**
 * Admin guests page.
 * Fetches all parties, guests, RSVPs, dietary restrictions, and events
 * server-side, then passes the assembled data to a client component
 * for search, filter, expand, and CSV export interactivity.
 */
export default async function AdminGuestsPage() {
  const supabase = createServiceClient();

  // Fetch everything in parallel
  const [partiesResult, guestsResult, eventsResult, rsvpsResult, dietResult] =
    await Promise.all([
      supabase
        .from("parties")
        .select("id, invite_name, party_size, email, phone, notes")
        .order("invite_name"),
      supabase
        .from("guests")
        .select("id, party_id, first_name, last_name, is_placeholder")
        .order("created_at"),
      supabase.from("events").select("id, name").order("sort_order"),
      supabase.from("rsvps").select("guest_id, event_id, status"),
      supabase.from("dietary_restrictions").select("guest_id, notes"),
    ]);

  const parties = partiesResult.data ?? [];
  const guests = guestsResult.data ?? [];
  const events = eventsResult.data ?? [];
  const rsvps = rsvpsResult.data ?? [];
  const diets = dietResult.data ?? [];

  // Build lookup maps for efficient assembly
  const eventNameById = new Map(events.map((e) => [e.id, e.name]));

  const rsvpsByGuestId = new Map<string, { event_name: string; status: string }[]>();
  for (const r of rsvps) {
    const list = rsvpsByGuestId.get(r.guest_id) ?? [];
    list.push({
      event_name: eventNameById.get(r.event_id) ?? "Unknown",
      status: r.status,
    });
    rsvpsByGuestId.set(r.guest_id, list);
  }

  const dietByGuestId = new Map(diets.map((d) => [d.guest_id, d.notes]));

  // Assemble party rows with nested guest data
  const guestsByPartyId = new Map<string, typeof guests>();
  for (const g of guests) {
    const list = guestsByPartyId.get(g.party_id) ?? [];
    list.push(g);
    guestsByPartyId.set(g.party_id, list);
  }

  const partyRows: PartyRow[] = parties.map((p) => ({
    id: p.id,
    invite_name: p.invite_name,
    party_size: p.party_size,
    email: p.email,
    phone: p.phone,
    notes: p.notes,
    guests: (guestsByPartyId.get(p.id) ?? []).map((g) => ({
      id: g.id,
      first_name: g.first_name,
      last_name: g.last_name,
      is_placeholder: g.is_placeholder,
      rsvps: rsvpsByGuestId.get(g.id) ?? [],
      dietary_notes: dietByGuestId.get(g.id) ?? null,
    })),
  }));

  return (
    <div className="max-w-6xl">
      <h1 className="font-heading text-3xl text-deep-sage mb-8">Guests</h1>
      <GuestsTable parties={partyRows} />
    </div>
  );
}
