"use server";

import { cookies } from "next/headers";
import { createServiceClient } from "@/lib/supabase/server";

const COOKIE_NAME = "rsvp_party_id";

/**
 * Get the current party ID from the RSVP session cookie.
 */
async function getPartyId(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(COOKIE_NAME)?.value || null;
}

/**
 * Fetch all registry items for the public registry page.
 * Returns items with status info but hides claimed_by_party_id
 * from other parties.
 */
export async function getRegistryItems() {
  const supabase = createServiceClient();
  const partyId = await getPartyId();

  const { data: items, error } = await supabase
    .from("registry_items")
    .select("*")
    .order("sort_order", { ascending: true });

  if (error) {
    return { items: [], error: error.message };
  }

  // Map items: show if the current party claimed it, hide other parties' info
  const mapped = (items || []).map((item) => ({
    id: item.id,
    name: item.name,
    description: item.description,
    price_cents: item.price_cents,
    merchant_name: item.merchant_name,
    merchant_url: item.merchant_url,
    image_url: item.image_url,
    status: item.status,
    sort_order: item.sort_order,
    // Only reveal if THIS party claimed it
    claimed_by_me: partyId ? item.claimed_by_party_id === partyId : false,
  }));

  return { items: mapped, error: null };
}

/**
 * Claim a registry item (mark as pending_purchase).
 * Sets the item's claimed_by_party_id to the current party.
 */
export async function claimItem(itemId: string) {
  const partyId = await getPartyId();

  if (!partyId) {
    return { error: "Please RSVP first so we know who you are!" };
  }

  const supabase = createServiceClient();

  // Check the item is still available
  const { data: item } = await supabase
    .from("registry_items")
    .select("id, status, name")
    .eq("id", itemId)
    .single();

  if (!item) {
    return { error: "Item not found." };
  }

  if (item.status === "purchased") {
    return { error: "This item has already been purchased." };
  }

  if (item.status === "pending") {
    return { error: "Someone else is looking at this item right now. Check back in a bit!" };
  }

  // Mark as pending
  const { error: updateError } = await supabase
    .from("registry_items")
    .update({
      status: "pending",
      claimed_by_party_id: partyId,
      claimed_at: new Date().toISOString(),
    })
    .eq("id", itemId)
    .eq("status", "available");

  if (updateError) {
    return { error: "Could not claim this item. Please try again." };
  }

  // Log the claim event
  await supabase.from("registry_claim_events").insert({
    registry_item_id: itemId,
    party_id: partyId,
    action: "claimed",
  });

  return { error: null };
}

/**
 * Confirm purchase of a claimed item.
 */
export async function confirmPurchase(itemId: string) {
  const partyId = await getPartyId();

  if (!partyId) {
    return { error: "Session expired. Please RSVP again." };
  }

  const supabase = createServiceClient();

  const { error: updateError } = await supabase
    .from("registry_items")
    .update({
      status: "purchased",
      purchased_at: new Date().toISOString(),
    })
    .eq("id", itemId)
    .eq("claimed_by_party_id", partyId);

  if (updateError) {
    return { error: "Could not confirm purchase. Please try again." };
  }

  await supabase.from("registry_claim_events").insert({
    registry_item_id: itemId,
    party_id: partyId,
    action: "confirmed_purchase",
  });

  return { error: null };
}

/**
 * Release a claimed item back to available.
 */
export async function releaseItem(itemId: string) {
  const partyId = await getPartyId();

  if (!partyId) {
    return { error: "Session expired." };
  }

  const supabase = createServiceClient();

  const { error: updateError } = await supabase
    .from("registry_items")
    .update({
      status: "available",
      claimed_by_party_id: null,
      claimed_at: null,
    })
    .eq("id", itemId)
    .eq("claimed_by_party_id", partyId);

  if (updateError) {
    return { error: "Could not release item." };
  }

  await supabase.from("registry_claim_events").insert({
    registry_item_id: itemId,
    party_id: partyId,
    action: "cancelled",
  });

  return { error: null };
}
