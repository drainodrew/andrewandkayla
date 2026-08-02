"use server";

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/server";
import {
  DEFAULT_SEAT_COUNT,
  HEAD_TABLE_DEPTH_FT,
  HEAD_TABLE_WIDTH_FT,
  ROUND_TABLE_DIAMETER_FT,
  TENT_DEPTH_FT,
  TENT_WIDTH_FT,
  autoLayoutPositions,
} from "@/lib/seating";

const SEATING_PATH = "/admin/seating";

/**
 * Add one round table, dropped into the first grid slot that isn't already
 * occupied so new tables don't stack on top of each other at the origin.
 */
export async function addRoundTable() {
  const supabase = createServiceClient();

  const { data: existing } = await supabase
    .from("floor_plan_objects")
    .select("x_ft, y_ft, kind, label");

  const rounds = (existing ?? []).filter((o) => o.kind === "round_table");

  // Next free slot on the auto-layout grid. Considers EVERY object, not just
  // round tables, so a new table doesn't land on top of the head table.
  const grid = autoLayoutPositions(200);
  const taken = new Set(
    (existing ?? []).map(
      (o) => `${Number(o.x_ft).toFixed(1)},${Number(o.y_ft).toFixed(1)}`
    )
  );
  const slot =
    grid.find((p) => !taken.has(`${p.x.toFixed(1)},${p.y.toFixed(1)}`)) ??
    { x: TENT_WIDTH_FT / 2, y: TENT_DEPTH_FT / 2 };

  // Label as the next unused "Table N" rather than count+1, so deleting
  // table 3 and adding one doesn't produce a duplicate label.
  const usedNumbers = new Set(
    rounds
      .map((o) => /^Table (\d+)$/.exec(o.label)?.[1])
      .filter(Boolean)
      .map(Number)
  );
  let next = 1;
  while (usedNumbers.has(next)) next++;

  const { error } = await supabase.from("floor_plan_objects").insert({
    kind: "round_table",
    label: `Table ${next}`,
    x_ft: slot.x,
    y_ft: slot.y,
    seat_count: DEFAULT_SEAT_COUNT,
    diameter_ft: ROUND_TABLE_DIAMETER_FT,
    sort_order: next,
  });

  if (error) return { error: error.message };
  revalidatePath(SEATING_PATH);
  return { success: true };
}

export async function addHeadTable() {
  const supabase = createServiceClient();

  // Drop it into a free grid slot rather than a fixed spot near the front.
  // A fixed default lands on top of the first row of round tables as soon as
  // the grid is generated, which looks broken even though it's only a
  // starting position Andrew would drag anyway.
  const { data: existing } = await supabase
    .from("floor_plan_objects")
    .select("x_ft, y_ft");

  const taken = new Set(
    (existing ?? []).map(
      (o) => `${Number(o.x_ft).toFixed(1)},${Number(o.y_ft).toFixed(1)}`
    )
  );
  const slot =
    autoLayoutPositions(200).find(
      (p) => !taken.has(`${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    ) ?? { x: TENT_WIDTH_FT / 2, y: TENT_DEPTH_FT / 2 };

  const { error } = await supabase.from("floor_plan_objects").insert({
    kind: "head_table",
    label: "Head Table",
    x_ft: slot.x,
    y_ft: slot.y,
    seat_count: 2,
    width_ft: HEAD_TABLE_WIDTH_FT,
    height_ft: HEAD_TABLE_DEPTH_FT,
    sort_order: 0,
  });

  if (error) return { error: error.message };
  revalidatePath(SEATING_PATH);
  return { success: true };
}

/**
 * Create `count` round tables laid out on a grid in one shot, so Andrew
 * doesn't click "add table" 26 times. Only fills empty grid slots.
 */
export async function generateRoundTables(count: number) {
  const supabase = createServiceClient();

  if (!Number.isInteger(count) || count < 1 || count > 60) {
    return { error: "Table count must be between 1 and 60." };
  }

  // Every object occupies a slot, including the head table.
  const { data: existing } = await supabase
    .from("floor_plan_objects")
    .select("x_ft, y_ft, kind, label");

  const taken = new Set(
    (existing ?? []).map(
      (o) => `${Number(o.x_ft).toFixed(1)},${Number(o.y_ft).toFixed(1)}`
    )
  );
  const usedNumbers = new Set(
    (existing ?? [])
      .filter((o) => o.kind === "round_table")
      .map((o) => /^Table (\d+)$/.exec(o.label)?.[1])
      .filter(Boolean)
      .map(Number)
  );

  const free = autoLayoutPositions(200).filter(
    (p) => !taken.has(`${p.x.toFixed(1)},${p.y.toFixed(1)}`)
  );

  if (free.length < count) {
    return {
      error: `Only ${free.length} grid slots left in the tent at a comfortable spacing. Place fewer, or drag tables closer manually.`,
    };
  }

  let next = 1;
  const rows = free.slice(0, count).map((p) => {
    while (usedNumbers.has(next)) next++;
    usedNumbers.add(next);
    return {
      kind: "round_table",
      label: `Table ${next}`,
      x_ft: p.x,
      y_ft: p.y,
      seat_count: DEFAULT_SEAT_COUNT,
      diameter_ft: ROUND_TABLE_DIAMETER_FT,
      sort_order: next,
    };
  });

  const { error } = await supabase.from("floor_plan_objects").insert(rows);
  if (error) return { error: error.message };

  revalidatePath(SEATING_PATH);
  return { success: true };
}

/**
 * Persist a dragged position.
 *
 * Deliberately does NOT revalidate: the client already holds the authoritative
 * position while dragging, and a revalidate on every pointerup would push a
 * server render back over the top of in-flight drags and make tables jump.
 */
export async function updateObjectPosition(
  id: string,
  xFt: number,
  yFt: number
) {
  const supabase = createServiceClient();

  if (!Number.isFinite(xFt) || !Number.isFinite(yFt)) {
    return { error: "Invalid position." };
  }

  const { error } = await supabase
    .from("floor_plan_objects")
    .update({
      x_ft: Math.min(TENT_WIDTH_FT, Math.max(0, xFt)),
      y_ft: Math.min(TENT_DEPTH_FT, Math.max(0, yFt)),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) return { error: error.message };
  return { success: true };
}

export async function updateObject(
  id: string,
  patch: { label?: string; seat_count?: number; rotation_deg?: number }
) {
  const supabase = createServiceClient();

  const update: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (patch.label !== undefined) {
    if (!patch.label.trim()) return { error: "Label can't be empty." };
    update.label = patch.label.trim();
  }

  if (patch.seat_count !== undefined) {
    if (
      !Number.isInteger(patch.seat_count) ||
      patch.seat_count < 0 ||
      patch.seat_count > 12
    ) {
      return { error: "Seat count must be between 0 and 12." };
    }

    // Shrinking a table would orphan people in seats that no longer exist.
    // Drop those assignments back to unseated rather than leaving rows that
    // point at a chair number the table doesn't have.
    const { data: overflow } = await supabase
      .from("seat_assignments")
      .select("id")
      .eq("object_id", id)
      .gt("seat_number", patch.seat_count);

    if (overflow && overflow.length > 0) {
      await supabase
        .from("seat_assignments")
        .delete()
        .in(
          "id",
          overflow.map((r) => r.id)
        );
    }

    update.seat_count = patch.seat_count;
  }

  if (patch.rotation_deg !== undefined) {
    update.rotation_deg = patch.rotation_deg;
  }

  const { error } = await supabase
    .from("floor_plan_objects")
    .update(update)
    .eq("id", id);

  if (error) return { error: error.message };
  revalidatePath(SEATING_PATH);
  return { success: true };
}

/** Delete a table. Its seat assignments cascade, freeing those guests. */
export async function deleteObject(id: string) {
  const supabase = createServiceClient();

  const { error } = await supabase
    .from("floor_plan_objects")
    .delete()
    .eq("id", id);

  if (error) return { error: error.message };
  revalidatePath(SEATING_PATH);
  return { success: true };
}

/**
 * Seat a guest. `seatNumber` null means "at this table, chair TBD".
 *
 * Upserts on guest_id (which is UNIQUE), so seating someone who is already
 * seated elsewhere moves them instead of double-booking.
 */
export async function assignSeat(
  guestId: string,
  objectId: string,
  seatNumber: number | null
) {
  const supabase = createServiceClient();

  if (seatNumber !== null) {
    const { data: occupant } = await supabase
      .from("seat_assignments")
      .select("guest_id")
      .eq("object_id", objectId)
      .eq("seat_number", seatNumber)
      .maybeSingle();

    if (occupant && occupant.guest_id !== guestId) {
      return { error: "That seat is already taken." };
    }
  }

  const { error } = await supabase.from("seat_assignments").upsert(
    {
      guest_id: guestId,
      object_id: objectId,
      seat_number: seatNumber,
    },
    { onConflict: "guest_id" }
  );

  if (error) return { error: error.message };
  revalidatePath(SEATING_PATH);
  return { success: true };
}

export async function unassignSeat(guestId: string) {
  const supabase = createServiceClient();

  const { error } = await supabase
    .from("seat_assignments")
    .delete()
    .eq("guest_id", guestId);

  if (error) return { error: error.message };
  revalidatePath(SEATING_PATH);
  return { success: true };
}

/**
 * Seat every currently-unseated guest of a party at one table, filling the
 * lowest-numbered empty chairs. This is the actual workflow: you seat
 * families together, not one person at a time.
 */
export async function seatPartyAtTable(partyId: string, objectId: string) {
  const supabase = createServiceClient();

  const [objectResult, partyGuestsResult, assignmentsResult] = await Promise.all(
    [
      supabase
        .from("floor_plan_objects")
        .select("seat_count")
        .eq("id", objectId)
        .single(),
      supabase.from("guests").select("id").eq("party_id", partyId),
      supabase.from("seat_assignments").select("guest_id, seat_number"),
    ]
  );

  if (objectResult.error || !objectResult.data) {
    return { error: "Table not found." };
  }

  const seatCount = objectResult.data.seat_count;
  const allAssignments = assignmentsResult.data ?? [];
  const seatedGuestIds = new Set(allAssignments.map((a) => a.guest_id));

  const toSeat = (partyGuestsResult.data ?? [])
    .map((g) => g.id)
    .filter((id) => !seatedGuestIds.has(id));

  if (toSeat.length === 0) {
    return { error: "Everyone in that party is already seated." };
  }

  // Which chairs at this table are free
  const { data: tableAssignments } = await supabase
    .from("seat_assignments")
    .select("seat_number")
    .eq("object_id", objectId);

  const occupied = new Set(
    (tableAssignments ?? [])
      .map((a) => a.seat_number)
      .filter((n): n is number => n !== null)
  );

  const freeSeats: number[] = [];
  for (let n = 1; n <= seatCount; n++) {
    if (!occupied.has(n)) freeSeats.push(n);
  }

  if (freeSeats.length < toSeat.length) {
    return {
      error: `Only ${freeSeats.length} seat${freeSeats.length === 1 ? "" : "s"} free at that table, but ${toSeat.length} to seat.`,
    };
  }

  const rows = toSeat.map((guestId, i) => ({
    guest_id: guestId,
    object_id: objectId,
    seat_number: freeSeats[i],
  }));

  const { error } = await supabase
    .from("seat_assignments")
    .upsert(rows, { onConflict: "guest_id" });

  if (error) return { error: error.message };
  revalidatePath(SEATING_PATH);
  return { success: true, seated: rows.length };
}

/** Empty a table without deleting it. */
export async function clearTable(objectId: string) {
  const supabase = createServiceClient();

  const { error } = await supabase
    .from("seat_assignments")
    .delete()
    .eq("object_id", objectId);

  if (error) return { error: error.message };
  revalidatePath(SEATING_PATH);
  return { success: true };
}
