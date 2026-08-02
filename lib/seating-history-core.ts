/**
 * Seating history internals.
 *
 * Deliberately NOT a "use server" module. Anything exported from one of those
 * becomes a public POST endpoint, and captureSnapshot/ensureBaseline take a
 * `createdBy` string that would then be attacker-supplied. These are called
 * only from server actions that have already checked the caller is an admin,
 * so they live here where the network can't reach them directly.
 */
import { createServiceClient } from "@/lib/supabase/server";

/**
 * How many snapshots to keep. At ~20KB each this is well under a megabyte,
 * and nobody undoes 200 steps. Pruning keeps the table from growing forever
 * across months of fiddling with the layout.
 */
const MAX_SNAPSHOTS = 200;

export interface HistoryState {
  canUndo: boolean;
  canRedo: boolean;
  undoLabel: string | null;
  redoLabel: string | null;
  lastEditedBy: string | null;
  lastEditedAt: string | null;
}

export interface FloorPlanState {
  objects: Record<string, unknown>[];
  assignments: Record<string, unknown>[];
}

const EMPTY_HISTORY: HistoryState = {
  canUndo: false,
  canRedo: false,
  undoLabel: null,
  redoLabel: null,
  lastEditedBy: null,
  lastEditedAt: null,
};

export type Supabase = ReturnType<typeof createServiceClient>;

/** Read the entire floor plan as a snapshot payload. */
async function readFloorPlan(supabase: Supabase): Promise<FloorPlanState> {
  const [objectsResult, assignmentsResult] = await Promise.all([
    supabase
      .from("floor_plan_objects")
      .select(
        "id, kind, label, internal_name, x_ft, y_ft, rotation_deg, seat_count, diameter_ft, width_ft, height_ft, sort_order"
      )
      .order("sort_order"),
    supabase
      .from("seat_assignments")
      .select("guest_id, object_id, seat_number"),
  ]);

  return {
    objects: objectsResult.data ?? [],
    assignments: assignmentsResult.data ?? [],
  };
}

/**
 * Replace the live floor plan with a snapshot.
 *
 * Deleting the objects cascades their seat assignments, so this is a clean
 * wipe-and-reinsert rather than a diff. Snapshots preserve the original
 * uuids, so restoring keeps assignment -> object references intact.
 */
export async function restoreFloorPlan(
  supabase: Supabase,
  state: FloorPlanState
): Promise<{ error?: string }> {
  // PostgREST refuses an unfiltered delete, hence the always-true predicate.
  const { error: deleteError } = await supabase
    .from("floor_plan_objects")
    .delete()
    .not("id", "is", null);

  if (deleteError) return { error: deleteError.message };

  if (state.objects.length > 0) {
    const { error } = await supabase
      .from("floor_plan_objects")
      .insert(state.objects);
    if (error) return { error: error.message };
  }

  if (state.assignments.length > 0) {
    // A guest can be deleted between snapshot and restore. Their assignment
    // would violate the foreign key and fail the whole restore, so drop any
    // that no longer point at a real guest.
    const { data: guests } = await supabase.from("guests").select("id");
    const liveGuestIds = new Set((guests ?? []).map((g) => g.id));

    const valid = state.assignments.filter((a) =>
      liveGuestIds.has(a.guest_id as string)
    );

    if (valid.length > 0) {
      const { error } = await supabase.from("seat_assignments").insert(valid);
      if (error) return { error: error.message };
    }
  }

  return {};
}

export async function buildHistoryState(supabase: Supabase): Promise<HistoryState> {
  const [pointerResult, snapshotsResult] = await Promise.all([
    supabase
      .from("seating_history_pointer")
      .select("current_seq, updated_at")
      .eq("id", true)
      .maybeSingle(),
    supabase
      .from("seating_snapshots")
      .select("seq, label, created_by, created_at")
      .order("seq", { ascending: true }),
  ]);

  const snapshots = snapshotsResult.data ?? [];
  if (snapshots.length === 0) return EMPTY_HISTORY;

  const currentSeq = pointerResult.data?.current_seq ?? null;
  const index = snapshots.findIndex((s) => s.seq === currentSeq);

  const current = index >= 0 ? snapshots[index] : null;
  const previous = index > 0 ? snapshots[index - 1] : null;
  const next =
    index >= 0 && index < snapshots.length - 1 ? snapshots[index + 1] : null;

  return {
    // Undoing means going back to `previous`, so it needs one to exist.
    canUndo: previous !== null,
    canRedo: next !== null,
    // The undo button describes the change being reversed, which is the
    // label on the CURRENT snapshot, not the one we're moving to.
    undoLabel: previous !== null ? (current?.label ?? null) : null,
    redoLabel: next?.label ?? null,
    lastEditedBy: current?.created_by ?? null,
    lastEditedAt: current?.created_at ?? null,
  };
}

/**
 * Record the current floor plan as a new history entry.
 *
 * Called after a mutation succeeds. Truncates any redo future first: once you
 * make a new edit, the branch you'd previously undone away is gone, which is
 * how undo stacks behave everywhere else.
 */
export async function captureSnapshot(
  label: string,
  createdBy?: string
): Promise<HistoryState> {
  const supabase = createServiceClient();

  const { data: pointer } = await supabase
    .from("seating_history_pointer")
    .select("current_seq")
    .eq("id", true)
    .maybeSingle();

  const currentSeq = pointer?.current_seq ?? null;

  // Discard the abandoned redo branch.
  if (currentSeq !== null) {
    await supabase.from("seating_snapshots").delete().gt("seq", currentSeq);
  } else {
    // Pointer at the beginning: everything recorded is redo-future.
    await supabase.from("seating_snapshots").delete().not("seq", "is", null);
  }

  const state = await readFloorPlan(supabase);

  const { data: inserted, error } = await supabase
    .from("seating_snapshots")
    .insert({ state, label, created_by: createdBy ?? null })
    .select("seq")
    .single();

  if (error || !inserted) return buildHistoryState(supabase);

  await supabase
    .from("seating_history_pointer")
    .update({ current_seq: inserted.seq, updated_at: new Date().toISOString() })
    .eq("id", true);

  // Prune the oldest entries beyond the cap.
  const { data: all } = await supabase
    .from("seating_snapshots")
    .select("seq")
    .order("seq", { ascending: false });

  if (all && all.length > MAX_SNAPSHOTS) {
    const cutoff = all[MAX_SNAPSHOTS - 1].seq;
    await supabase.from("seating_snapshots").delete().lt("seq", cutoff);
  }

  return buildHistoryState(supabase);
}

/**
 * Seed a baseline snapshot if history is empty, so the very first edit has
 * something to undo back to. Without this, edit #1 would be unundoable.
 */
export async function ensureBaseline(createdBy?: string): Promise<void> {
  const supabase = createServiceClient();

  const { count } = await supabase
    .from("seating_snapshots")
    .select("seq", { count: "exact", head: true });

  if ((count ?? 0) > 0) return;

  const state = await readFloorPlan(supabase);

  const { data: inserted } = await supabase
    .from("seating_snapshots")
    .insert({
      state,
      label: "Starting layout",
      created_by: createdBy ?? null,
    })
    .select("seq")
    .single();

  if (inserted) {
    await supabase
      .from("seating_history_pointer")
      .update({
        current_seq: inserted.seq,
        updated_at: new Date().toISOString(),
      })
      .eq("id", true);
  }
}

