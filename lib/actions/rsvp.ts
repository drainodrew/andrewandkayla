"use server";

import { cookies } from "next/headers";
import { createServiceClient } from "@/lib/supabase/server";

const COOKIE_NAME = "rsvp_party_id";
// Cookie expires Sept 30, 2026 (30 days after wedding)
const COOKIE_EXPIRES = new Date("2026-09-30T00:00:00Z");

/**
 * Set the RSVP session cookie after a guest selects their party.
 */
export async function selectParty(partyId: string) {
  const supabase = createServiceClient();

  // Verify the party exists
  const { data: party, error } = await supabase
    .from("parties")
    .select("id, invite_name")
    .eq("id", partyId)
    .single();

  if (error || !party) {
    return { error: "Party not found." };
  }

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, partyId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    expires: COOKIE_EXPIRES,
    path: "/",
  });

  return { success: true, partyName: party.invite_name };
}

/**
 * Get the current RSVP session (party + guests + existing RSVPs).
 */
export async function getRsvpSession() {
  const cookieStore = await cookies();
  const partyId = cookieStore.get(COOKIE_NAME)?.value;

  if (!partyId) {
    return { party: null, guests: null, events: null };
  }

  const supabase = createServiceClient();

  // Fetch party, guests, all events, and party-specific event invites in parallel
  const [partyResult, guestsResult, allEventsResult, partyEventsResult] = await Promise.all([
    supabase
      .from("parties")
      .select("id, invite_name, party_size")
      .eq("id", partyId)
      .single(),
    supabase
      .from("guests")
      .select("id, first_name, last_name, is_placeholder")
      .eq("party_id", partyId)
      .order("created_at"),
    supabase.from("events").select("*").order("sort_order"),
    // Which events this party is explicitly invited to
    supabase.from("party_events").select("event_id").eq("party_id", partyId),
  ]);

  // Filter events: wedding is universal (slug contains "wedding"),
  // other events require an explicit party_events row
  const invitedEventIds = new Set((partyEventsResult.data ?? []).map((pe) => pe.event_id));
  const eventsResult = {
    ...allEventsResult,
    data: (allEventsResult.data ?? []).filter(
      (e) => e.slug?.includes("wedding") || invitedEventIds.has(e.id)
    ),
  };

  if (partyResult.error || !partyResult.data) {
    // Cookie references a party that no longer exists
    const cs = await cookies();
    cs.delete(COOKIE_NAME);
    return { party: null, guests: null, events: null };
  }

  // Fetch existing RSVPs for all guests in this party
  const guestIds = (guestsResult.data || []).map((g) => g.id);
  let rsvps: Record<string, Record<string, string>> = {};

  if (guestIds.length > 0) {
    const { data: rsvpData } = await supabase
      .from("rsvps")
      .select("guest_id, event_id, status")
      .in("guest_id", guestIds);

    if (rsvpData) {
      for (const r of rsvpData) {
        if (!rsvps[r.guest_id]) rsvps[r.guest_id] = {};
        rsvps[r.guest_id][r.event_id] = r.status;
      }
    }
  }

  // Fetch dietary restrictions
  let dietaryNotes: Record<string, string> = {};
  if (guestIds.length > 0) {
    const { data: dietData } = await supabase
      .from("dietary_restrictions")
      .select("guest_id, notes")
      .in("guest_id", guestIds);

    if (dietData) {
      for (const d of dietData) {
        dietaryNotes[d.guest_id] = d.notes;
      }
    }
  }

  return {
    party: partyResult.data,
    guests: guestsResult.data,
    events: eventsResult.data,
    rsvps,
    dietaryNotes,
  };
}

/**
 * Submit RSVPs for all guests in a party.
 */
export async function submitRsvp(formData: {
  rsvps: { guestId: string; eventId: string; status: "attending" | "declined" }[];
  dietaryRestrictions: { guestId: string; notes: string }[];
}) {
  const cookieStore = await cookies();
  const partyId = cookieStore.get(COOKIE_NAME)?.value;

  if (!partyId) {
    return { error: "No RSVP session. Please search for your name first." };
  }

  const supabase = createServiceClient();

  // Verify guests belong to this party
  const { data: partyGuests } = await supabase
    .from("guests")
    .select("id")
    .eq("party_id", partyId);

  const validGuestIds = new Set((partyGuests || []).map((g) => g.id));

  // Validate all guest IDs in the submission
  for (const rsvp of formData.rsvps) {
    if (!validGuestIds.has(rsvp.guestId)) {
      return { error: "Invalid guest in submission." };
    }
  }

  // Upsert RSVPs
  const now = new Date().toISOString();
  for (const rsvp of formData.rsvps) {
    const { error } = await supabase.from("rsvps").upsert(
      {
        guest_id: rsvp.guestId,
        event_id: rsvp.eventId,
        status: rsvp.status,
        responded_at: now,
      },
      { onConflict: "guest_id,event_id" }
    );

    if (error) {
      console.error("RSVP upsert error:", error);
      return { error: "Failed to save RSVP. Please try again." };
    }
  }

  // Upsert dietary restrictions
  for (const diet of formData.dietaryRestrictions) {
    if (!validGuestIds.has(diet.guestId)) continue;

    if (diet.notes.trim()) {
      const { error } = await supabase.from("dietary_restrictions").upsert(
        {
          guest_id: diet.guestId,
          notes: diet.notes.trim(),
        },
        { onConflict: "guest_id" }
      );

      if (error) {
        console.error("Dietary restriction upsert error:", error);
      }
    } else {
      // Remove dietary restriction if notes are empty
      await supabase
        .from("dietary_restrictions")
        .delete()
        .eq("guest_id", diet.guestId);
    }
  }

  return { success: true };
}

/**
 * Clear the RSVP session (let someone search for a different party).
 */
export async function clearRsvpSession() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
  return { success: true };
}
