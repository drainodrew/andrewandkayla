"use server";

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/supabase/require-admin";
import {
  captureSnapshot,
  ensureBaseline,
  type HistoryState,
} from "@/lib/seating-history-core";
import {
  DEFAULT_SEAT_COUNT,
  DEFAULT_HEAD_TABLE_SEATS,
  HEAD_TABLE_DEPTH_FT,
  HEAD_TABLE_WIDTH_FT,
  ROUND_TABLE_DIAMETER_FT,
  headTableWidthFor,
  TENT_DEPTH_FT,
  TENT_WIDTH_FT,
  autoLayoutPositions,
} from "@/lib/seating";

const SEATING_PATH = "/admin/seating";

export interface MutationResult {
  error?: string;
  history?: HistoryState;
  success?: boolean;
}

/**
 * Wrap a floor plan mutation with the three things every one of them needs:
 * an admin check, a baseline history entry, and a snapshot afterwards.
 *
 * `label` describes the change for the undo button. It's a function so it can
 * name things the mutation looked up (a table's label, a guest's name) without
 * every caller re-querying.
 */
async function mutate(
  run: (supabase: ReturnType<typeof createServiceClient>) => Promise<
    { error: string; label?: undefined } | { error?: undefined; label: string }
  >,
  options: { revalidate?: boolean } = {}
): Promise<MutationResult> {
  const auth = await requireAdmin();
  if (auth.error) return { error: auth.error };

  const supabase = createServiceClient();

  // Snapshot the pre-change state the first time anyone touches the plan,
  // otherwise the first edit has nothing to undo back to.
  await ensureBaseline(auth.email);

  const result = await run(supabase);
  if (result.error) return { error: result.error };

  // TS can't narrow the union on a truthiness check alone (an empty-string
  // error is still typed string), so the fallback is unreachable in practice
  // but keeps this honest without restructuring every return below.
  const history = await captureSnapshot(
    result.label ?? "Edit floor plan",
    auth.email
  );

  if (options.revalidate !== false) revalidatePath(SEATING_PATH);
  return { success: true, history };
}

/** Grid slots already occupied by any object, so nothing stacks. */
async function takenSlots(supabase: ReturnType<typeof createServiceClient>) {
  const { data } = await supabase.from("floor_plan_objects").select("x_ft, y_ft");
  return new Set(
    (data ?? []).map(
      (o) => `${Number(o.x_ft).toFixed(1)},${Number(o.y_ft).toFixed(1)}`
    )
  );
}

function firstFreeSlot(taken: Set<string>) {
  return (
    autoLayoutPositions(200).find(
      (p) => !taken.has(`${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    ) ?? { x: TENT_WIDTH_FT / 2, y: TENT_DEPTH_FT / 2 }
  );
}

export async function addRoundTable(): Promise<MutationResult> {
  return mutate(async (supabase) => {
    const { data: existing } = await supabase
      .from("floor_plan_objects")
      .select("kind, label");

    // Next unused "Table N" rather than count+1, so deleting table 3 and
    // adding one back doesn't produce a duplicate label.
    const usedNumbers = new Set(
      (existing ?? [])
        .filter((o) => o.kind === "round_table")
        .map((o) => /^Table (\d+)$/.exec(o.label)?.[1])
        .filter(Boolean)
        .map(Number)
    );
    let next = 1;
    while (usedNumbers.has(next)) next++;

    const slot = firstFreeSlot(await takenSlots(supabase));

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
    return { label: `Add Table ${next}` };
  });
}

export async function addHeadTable(): Promise<MutationResult> {
  return mutate(async (supabase) => {
    // Free grid slot rather than a fixed spot near the front: a fixed default
    // lands on top of the first row of round tables once the grid exists.
    const slot = firstFreeSlot(await takenSlots(supabase));

    const { error } = await supabase.from("floor_plan_objects").insert({
      kind: "head_table",
      label: "Head Table",
      x_ft: slot.x,
      y_ft: slot.y,
      seat_count: DEFAULT_HEAD_TABLE_SEATS,
      width_ft: HEAD_TABLE_WIDTH_FT,
      height_ft: HEAD_TABLE_DEPTH_FT,
      sort_order: 0,
    });

    if (error) return { error: error.message };
    return { label: "Add head table" };
  });
}

/** Create many round tables at once, so nobody clicks "add" 26 times. */
export async function generateRoundTables(
  count: number
): Promise<MutationResult> {
  return mutate(async (supabase) => {
    if (!Number.isInteger(count) || count < 1 || count > 60) {
      return { error: "Table count must be between 1 and 60." };
    }

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

    return { label: `Add ${count} tables` };
  });
}

/**
 * Persist a dragged position.
 *
 * `revalidate: false` because the client already holds the authoritative
 * position while dragging; pushing a server render back over an in-flight
 * drag makes tables jump under the cursor. The returned history state lets
 * the client update the undo button without a refetch.
 */
export async function updateObjectPosition(
  id: string,
  xFt: number,
  yFt: number
): Promise<MutationResult> {
  return mutate(
    async (supabase) => {
      if (!Number.isFinite(xFt) || !Number.isFinite(yFt)) {
        return { error: "Invalid position." };
      }

      const { data: existing } = await supabase
        .from("floor_plan_objects")
        .select("label")
        .eq("id", id)
        .maybeSingle();

      const { error } = await supabase
        .from("floor_plan_objects")
        .update({
          x_ft: Math.min(TENT_WIDTH_FT, Math.max(0, xFt)),
          y_ft: Math.min(TENT_DEPTH_FT, Math.max(0, yFt)),
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);

      if (error) return { error: error.message };
      return { label: `Move ${existing?.label ?? "table"}` };
    },
    { revalidate: false }
  );
}

/**
 * Move several objects at once, as ONE history entry.
 *
 * Dragging a multi-selection must undo as a single step. Calling
 * updateObjectPosition per table would push one snapshot each, so undoing a
 * 6-table drag would take six presses and leave the layout half-moved in
 * between.
 */
export async function updateObjectPositions(
  updates: { id: string; xFt: number; yFt: number }[]
): Promise<MutationResult> {
  return mutate(
    async (supabase) => {
      if (updates.length === 0) return { error: "Nothing to move." };

      for (const u of updates) {
        if (!Number.isFinite(u.xFt) || !Number.isFinite(u.yFt)) {
          return { error: "Invalid position." };
        }
      }

      const now = new Date().toISOString();
      const results = await Promise.all(
        updates.map((u) =>
          supabase
            .from("floor_plan_objects")
            .update({
              x_ft: Math.min(TENT_WIDTH_FT, Math.max(0, u.xFt)),
              y_ft: Math.min(TENT_DEPTH_FT, Math.max(0, u.yFt)),
              updated_at: now,
            })
            .eq("id", u.id)
        )
      );

      const failed = results.find((r) => r.error);
      if (failed?.error) return { error: failed.error.message };

      return {
        label:
          updates.length === 1
            ? "Move table"
            : `Move ${updates.length} tables`,
      };
    },
    { revalidate: false }
  );
}

/** Delete several objects as one history entry, for the same reason. */
export async function deleteObjects(ids: string[]): Promise<MutationResult> {
  return mutate(async (supabase) => {
    if (ids.length === 0) return { error: "Nothing to delete." };

    const { data: existing } = await supabase
      .from("floor_plan_objects")
      .select("label")
      .in("id", ids);

    const { error } = await supabase
      .from("floor_plan_objects")
      .delete()
      .in("id", ids);

    if (error) return { error: error.message };

    const label =
      ids.length === 1
        ? `Delete ${existing?.[0]?.label ?? "table"}`
        : `Delete ${ids.length} tables`;
    return { label };
  });
}

/** Set the seat count on several round tables at once. */
export async function updateSeatCounts(
  ids: string[],
  seatCount: number
): Promise<MutationResult> {
  return mutate(async (supabase) => {
    if (ids.length === 0) return { error: "Nothing to update." };
    if (!Number.isInteger(seatCount) || seatCount < 0 || seatCount > 12) {
      return { error: "Seat count must be between 0 and 12." };
    }

    // Same overflow rule as the single-table path: shrinking a table can't
    // leave people sitting in chairs that no longer exist.
    const { data: overflow } = await supabase
      .from("seat_assignments")
      .select("id")
      .in("object_id", ids)
      .gt("seat_number", seatCount);

    if (overflow && overflow.length > 0) {
      await supabase
        .from("seat_assignments")
        .delete()
        .in(
          "id",
          overflow.map((r) => r.id)
        );
    }

    // Head tables derive width from seat count, so they can't be bulk-set
    // alongside round tables without also resizing. Restrict to rounds.
    const { error } = await supabase
      .from("floor_plan_objects")
      .update({ seat_count: seatCount, updated_at: new Date().toISOString() })
      .in("id", ids)
      .eq("kind", "round_table");

    if (error) return { error: error.message };
    return { label: `Set ${ids.length} tables to ${seatCount} seats` };
  });
}

export async function updateObject(
  id: string,
  patch: {
    label?: string;
    internal_name?: string | null;
    seat_count?: number;
    rotation_deg?: number;
  }
): Promise<MutationResult> {
  return mutate(async (supabase) => {
    const update: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    const changes: string[] = [];

    const { data: existing } = await supabase
      .from("floor_plan_objects")
      .select("label, kind")
      .eq("id", id)
      .maybeSingle();

    const name = existing?.label ?? "table";

    if (patch.label !== undefined) {
      if (!patch.label.trim()) return { error: "Label can't be empty." };
      update.label = patch.label.trim();
      changes.push(`rename to ${patch.label.trim()}`);
    }

    if (patch.internal_name !== undefined) {
      // Empty clears it rather than storing "", so the column stays a clean
      // "has a name or doesn't" rather than two flavours of absent.
      const trimmed = patch.internal_name?.trim() || null;
      update.internal_name = trimmed;
      changes.push(
        trimmed ? `label ${name} as "${trimmed}"` : `clear ${name} group name`
      );
    }

    if (patch.seat_count !== undefined) {
      if (
        !Number.isInteger(patch.seat_count) ||
        patch.seat_count < 0 ||
        patch.seat_count > 12
      ) {
        return { error: "Seat count must be between 0 and 12." };
      }

      // Shrinking a table would orphan people in chairs that no longer exist.
      // Drop those back to unseated rather than leaving rows pointing at a
      // seat number the table doesn't have.
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

      // A head table's width is derived from its seat count, so widen or
      // narrow it to match. Without this, adding seats packs more people
      // into the same physical table and the plan stops being to scale.
      if (existing?.kind === "head_table") {
        update.width_ft = headTableWidthFor(patch.seat_count);
      }

      changes.push(`set ${name} to ${patch.seat_count} seats`);
    }

    if (patch.rotation_deg !== undefined) {
      update.rotation_deg = patch.rotation_deg;
      changes.push(`rotate ${name}`);
    }

    const { error } = await supabase
      .from("floor_plan_objects")
      .update(update)
      .eq("id", id);

    if (error) return { error: error.message };
    return { label: changes.join(", ") || `Edit ${name}` };
  });
}

/** Delete a table. Its seat assignments cascade, freeing those guests. */
export async function deleteObject(id: string): Promise<MutationResult> {
  return mutate(async (supabase) => {
    const { data: existing } = await supabase
      .from("floor_plan_objects")
      .select("label")
      .eq("id", id)
      .maybeSingle();

    const { error } = await supabase
      .from("floor_plan_objects")
      .delete()
      .eq("id", id);

    if (error) return { error: error.message };
    return { label: `Delete ${existing?.label ?? "table"}` };
  });
}

/**
 * Seat a guest. `seatNumber` null means "at this table, chair TBD".
 *
 * Upserts on guest_id (UNIQUE), so seating someone already seated elsewhere
 * moves them instead of double-booking.
 */
export async function assignSeat(
  guestId: string,
  objectId: string,
  seatNumber: number | null
): Promise<MutationResult> {
  return mutate(async (supabase) => {
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

    const [{ data: guest }, { data: object }] = await Promise.all([
      supabase
        .from("guests")
        .select("first_name, last_name")
        .eq("id", guestId)
        .maybeSingle(),
      supabase
        .from("floor_plan_objects")
        .select("label")
        .eq("id", objectId)
        .maybeSingle(),
    ]);

    const who = guest ? `${guest.first_name} ${guest.last_name}` : "guest";
    return { label: `Seat ${who} at ${object?.label ?? "table"}` };
  });
}

export async function unassignSeat(guestId: string): Promise<MutationResult> {
  return mutate(async (supabase) => {
    const { data: guest } = await supabase
      .from("guests")
      .select("first_name, last_name")
      .eq("id", guestId)
      .maybeSingle();

    const { error } = await supabase
      .from("seat_assignments")
      .delete()
      .eq("guest_id", guestId);

    if (error) return { error: error.message };

    const who = guest ? `${guest.first_name} ${guest.last_name}` : "guest";
    return { label: `Unseat ${who}` };
  });
}

/**
 * Seat every currently-unseated guest of a party at one table, filling the
 * lowest-numbered empty chairs. This is the real workflow: you seat families
 * together, not one person at a time.
 */
export async function seatPartyAtTable(
  partyId: string,
  objectId: string
): Promise<MutationResult> {
  return mutate(async (supabase) => {
    const [objectResult, partyResult, partyGuestsResult, assignmentsResult] =
      await Promise.all([
        supabase
          .from("floor_plan_objects")
          .select("seat_count, label")
          .eq("id", objectId)
          .single(),
        supabase
          .from("parties")
          .select("invite_name")
          .eq("id", partyId)
          .maybeSingle(),
        supabase.from("guests").select("id").eq("party_id", partyId),
        supabase.from("seat_assignments").select("guest_id"),
      ]);

    if (objectResult.error || !objectResult.data) {
      return { error: "Table not found." };
    }

    const seatCount = objectResult.data.seat_count;
    const seatedGuestIds = new Set(
      (assignmentsResult.data ?? []).map((a) => a.guest_id)
    );

    const toSeat = (partyGuestsResult.data ?? [])
      .map((g) => g.id)
      .filter((id) => !seatedGuestIds.has(id));

    if (toSeat.length === 0) {
      return { error: "Everyone in that party is already seated." };
    }

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

    return {
      label: `Seat ${partyResult.data?.invite_name ?? "party"} at ${objectResult.data.label}`,
    };
  });
}

/** Empty a table without deleting it. */
export async function clearTable(objectId: string): Promise<MutationResult> {
  return mutate(async (supabase) => {
    const { data: object } = await supabase
      .from("floor_plan_objects")
      .select("label")
      .eq("id", objectId)
      .maybeSingle();

    const { error } = await supabase
      .from("seat_assignments")
      .delete()
      .eq("object_id", objectId);

    if (error) return { error: error.message };
    return { label: `Clear ${object?.label ?? "table"}` };
  });
}
