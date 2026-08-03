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
  // Delegated to a Postgres function so the wipe and the re-insert are ONE
  // transaction. Doing it as separate PostgREST calls meant a failure between
  // them left the floor plan empty with the history pointer unmoved, which is
  // how a real layout of 23 tables ended up showing as zero. See
  // 20260802000004_atomic_restore.sql.
  const { error } = await supabase.rpc("restore_floor_plan", {
    snapshot: state,
  });

  if (error) return { error: error.message };
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

  // ONE round trip. This used to be seven separate queries (read pointer,
  // truncate the redo branch, read objects, read assignments, insert, move
  // the pointer, prune) and that latency was most of the 2-5s every seating
  // edit took. It is all set-based work, so it belongs in the database.
  const { data, error } = await supabase.rpc("capture_seating_snapshot", {
    p_label: label,
    p_created_by: createdBy ?? null,
    p_max_snapshots: MAX_SNAPSHOTS,
  });

  if (error || !data) return buildHistoryState(supabase);
  return data as HistoryState;
}

export async function ensureBaseline(createdBy?: string): Promise<void> {
  const supabase = createServiceClient();
  // Also one round trip; the emptiness check, insert and pointer update all
  // happen inside the function.
  await supabase.rpc("ensure_seating_baseline", {
    p_created_by: createdBy ?? null,
  });
}

