"use server";

import { createServiceClient } from "@/lib/supabase/server";

interface GuestInput {
  first_name: string;
  last_name: string;
}

interface AddPartyInput {
  invite_name: string;
  guests: GuestInput[];
  email?: string;
  phone?: string;
  address_line_1?: string;
  address_line_2?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  notes?: string;
}

export async function addParty(input: AddPartyInput) {
  const supabase = createServiceClient();

  if (!input.invite_name.trim()) {
    return { error: "Party name is required." };
  }

  if (input.guests.length === 0) {
    return { error: "At least one guest is required." };
  }

  for (const guest of input.guests) {
    if (!guest.first_name.trim() || !guest.last_name.trim()) {
      return { error: "First and last name are required for each guest." };
    }
  }

  // Check for duplicate party name
  const { data: existing } = await supabase
    .from("parties")
    .select("id")
    .eq("invite_name", input.invite_name.trim())
    .maybeSingle();

  if (existing) {
    return { error: `A party named "${input.invite_name}" already exists.` };
  }

  // Insert party
  const { data: party, error: partyError } = await supabase
    .from("parties")
    .insert({
      invite_name: input.invite_name.trim(),
      party_size: input.guests.length,
      email: input.email?.trim() || null,
      phone: input.phone?.trim() || null,
      address_line_1: input.address_line_1?.trim() || null,
      address_line_2: input.address_line_2?.trim() || null,
      city: input.city?.trim() || null,
      state: input.state?.trim() || null,
      zip_code: input.zip_code?.trim() || null,
      notes: input.notes?.trim() || null,
      source_tag: "admin-added",
    })
    .select("id")
    .single();

  if (partyError) {
    return { error: "Failed to create party: " + partyError.message };
  }

  // Insert guests
  for (const guest of input.guests) {
    const { error: guestError } = await supabase.from("guests").insert({
      party_id: party.id,
      first_name: guest.first_name.trim(),
      last_name: guest.last_name.trim(),
      is_placeholder: false,
    });

    if (guestError) {
      return {
        error: `Failed to add ${guest.first_name} ${guest.last_name}: ${guestError.message}`,
      };
    }
  }

  return { success: true, partyName: input.invite_name.trim() };
}

/**
 * Add a guest to an existing party and bump party_size.
 */
export async function addGuestToParty(
  partyId: string,
  guest: GuestInput
) {
  const supabase = createServiceClient();

  if (!guest.first_name.trim() || !guest.last_name.trim()) {
    return { error: "First and last name are required." };
  }

  // Verify party exists
  const { data: party, error: partyErr } = await supabase
    .from("parties")
    .select("id, party_size")
    .eq("id", partyId)
    .single();

  if (partyErr || !party) {
    return { error: "Party not found." };
  }

  // Insert guest
  const { error: guestError } = await supabase.from("guests").insert({
    party_id: partyId,
    first_name: guest.first_name.trim(),
    last_name: guest.last_name.trim(),
    is_placeholder: false,
  });

  if (guestError) {
    return { error: "Failed to add guest: " + guestError.message };
  }

  // Update party_size
  await supabase
    .from("parties")
    .update({ party_size: party.party_size + 1 })
    .eq("id", partyId);

  return { success: true };
}

/**
 * Move a guest from their current party into a new party.
 * Decrements the old party's size and creates a new party of 1.
 */
export async function separateGuestToNewParty(
  guestId: string,
  newPartyName: string
) {
  const supabase = createServiceClient();

  if (!newPartyName.trim()) {
    return { error: "New party name is required." };
  }

  // Get the guest and their current party
  const { data: guest, error: guestErr } = await supabase
    .from("guests")
    .select("id, first_name, last_name, party_id")
    .eq("id", guestId)
    .single();

  if (guestErr || !guest) {
    return { error: "Guest not found." };
  }

  const { data: oldParty } = await supabase
    .from("parties")
    .select("id, party_size")
    .eq("id", guest.party_id)
    .single();

  if (!oldParty || oldParty.party_size <= 1) {
    return { error: "Cannot separate the only guest in a party." };
  }

  // Create new party
  const { data: newParty, error: newPartyErr } = await supabase
    .from("parties")
    .insert({
      invite_name: newPartyName.trim(),
      party_size: 1,
      source_tag: "admin-separated",
    })
    .select("id")
    .single();

  if (newPartyErr) {
    return { error: "Failed to create new party: " + newPartyErr.message };
  }

  // Move guest to new party
  const { error: moveErr } = await supabase
    .from("guests")
    .update({ party_id: newParty.id })
    .eq("id", guestId);

  if (moveErr) {
    return { error: "Failed to move guest: " + moveErr.message };
  }

  // Copy party_events from old party to new party
  const { data: oldEvents } = await supabase
    .from("party_events")
    .select("event_id")
    .eq("party_id", oldParty.id);

  if (oldEvents && oldEvents.length > 0) {
    for (const pe of oldEvents) {
      await supabase.from("party_events").insert({
        party_id: newParty.id,
        event_id: pe.event_id,
      });
    }
  }

  // Decrement old party size
  await supabase
    .from("parties")
    .update({ party_size: oldParty.party_size - 1 })
    .eq("id", oldParty.id);

  return {
    success: true,
    guestName: `${guest.first_name} ${guest.last_name}`,
    newPartyName: newPartyName.trim(),
  };
}

/**
 * Fetch all parties for the dropdown picker.
 */
export async function listParties() {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("parties")
    .select("id, invite_name, party_size")
    .order("invite_name");

  if (error) return { error: error.message, parties: [] };
  return { parties: data ?? [] };
}

/**
 * Fetch all events.
 */
export async function listEvents() {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("events")
    .select("id, name, slug")
    .order("sort_order");

  if (error) return { error: error.message, events: [] };
  return { events: data ?? [] };
}

/**
 * Fetch which events a party is invited to (from party_events).
 */
export async function getPartyEvents(partyId: string) {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("party_events")
    .select("event_id")
    .eq("party_id", partyId);

  if (error) return { error: error.message, eventIds: [] };
  return { eventIds: (data ?? []).map((pe) => pe.event_id) };
}

/**
 * Add an event invitation for a party.
 */
export async function addPartyEvent(partyId: string, eventId: string) {
  const supabase = createServiceClient();

  // Check if already exists
  const { data: existing } = await supabase
    .from("party_events")
    .select("id")
    .eq("party_id", partyId)
    .eq("event_id", eventId)
    .maybeSingle();

  if (existing) {
    return { error: "Party is already invited to this event." };
  }

  const { error } = await supabase.from("party_events").insert({
    party_id: partyId,
    event_id: eventId,
  });

  if (error) return { error: "Failed to add event: " + error.message };
  return { success: true };
}

/**
 * Remove an event invitation from a party.
 * Also deletes any RSVPs for guests in that party for that event.
 */
export async function removePartyEvent(partyId: string, eventId: string) {
  const supabase = createServiceClient();

  // Get guest IDs in this party so we can clean up RSVPs
  const { data: guests } = await supabase
    .from("guests")
    .select("id")
    .eq("party_id", partyId);

  if (guests && guests.length > 0) {
    const guestIds = guests.map((g) => g.id);
    await supabase
      .from("rsvps")
      .delete()
      .in("guest_id", guestIds)
      .eq("event_id", eventId);
  }

  const { error } = await supabase
    .from("party_events")
    .delete()
    .eq("party_id", partyId)
    .eq("event_id", eventId);

  if (error) return { error: "Failed to remove event: " + error.message };
  return { success: true };
}

/**
 * Delete a guest from a party. Cleans up RSVPs and dietary restrictions.
 * Decrements party_size. If this was the last guest, deletes the party too.
 */
export async function deleteGuest(guestId: string) {
  const supabase = createServiceClient();

  const { data: guest, error: guestErr } = await supabase
    .from("guests")
    .select("id, first_name, last_name, party_id")
    .eq("id", guestId)
    .single();

  if (guestErr || !guest) {
    return { error: "Guest not found." };
  }

  // Delete RSVPs
  await supabase.from("rsvps").delete().eq("guest_id", guestId);
  // Delete dietary restrictions
  await supabase.from("dietary_restrictions").delete().eq("guest_id", guestId);
  // Delete guest
  const { error: delErr } = await supabase.from("guests").delete().eq("id", guestId);
  if (delErr) {
    return { error: "Failed to delete guest: " + delErr.message };
  }

  // Check remaining guests in party
  const { data: remaining } = await supabase
    .from("guests")
    .select("id")
    .eq("party_id", guest.party_id);

  if (!remaining || remaining.length === 0) {
    // Last guest, delete the whole party
    await supabase.from("party_events").delete().eq("party_id", guest.party_id);
    await supabase.from("parties").delete().eq("id", guest.party_id);
    return {
      success: true,
      guestName: `${guest.first_name} ${guest.last_name}`,
      partyDeleted: true,
    };
  } else {
    // Update party_size
    await supabase
      .from("parties")
      .update({ party_size: remaining.length })
      .eq("id", guest.party_id);
    return {
      success: true,
      guestName: `${guest.first_name} ${guest.last_name}`,
      partyDeleted: false,
    };
  }
}

/**
 * Delete an entire party and all its guests, RSVPs, dietary restrictions,
 * and party_events.
 */
export async function deleteParty(partyId: string) {
  const supabase = createServiceClient();

  const { data: party, error: partyErr } = await supabase
    .from("parties")
    .select("id, invite_name")
    .eq("id", partyId)
    .single();

  if (partyErr || !party) {
    return { error: "Party not found." };
  }

  // Get all guest IDs
  const { data: guests } = await supabase
    .from("guests")
    .select("id")
    .eq("party_id", partyId);

  if (guests && guests.length > 0) {
    const guestIds = guests.map((g) => g.id);
    await supabase.from("rsvps").delete().in("guest_id", guestIds);
    await supabase.from("dietary_restrictions").delete().in("guest_id", guestIds);
    await supabase.from("guests").delete().eq("party_id", partyId);
  }

  // Delete registry claims
  await supabase
    .from("registry_items")
    .update({ status: "available", claimed_by_party_id: null, claimed_at: null, purchased_at: null })
    .eq("claimed_by_party_id", partyId);

  await supabase.from("party_events").delete().eq("party_id", partyId);
  const { error: delErr } = await supabase.from("parties").delete().eq("id", partyId);

  if (delErr) {
    return { error: "Failed to delete party: " + delErr.message };
  }

  return { success: true, partyName: party.invite_name };
}

/**
 * Fetch guests in a specific party.
 */
export async function listGuestsInParty(partyId: string) {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("guests")
    .select("id, first_name, last_name")
    .eq("party_id", partyId)
    .order("created_at");

  if (error) return { error: error.message, guests: [] };
  return { guests: data ?? [] };
}
