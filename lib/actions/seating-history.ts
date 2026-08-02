"use server";

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/supabase/require-admin";
import {
  buildHistoryState,
  restoreFloorPlan,
  type FloorPlanState,
  type HistoryState,
} from "@/lib/seating-history-core";

const SEATING_PATH = "/admin/seating";

/**
 * Public server-action surface for seating history.
 *
 * Only these three are exported from a "use server" module, and every one of
 * them checks the caller first. The snapshot internals (captureSnapshot,
 * ensureBaseline) live in seating-history-core so they never become reachable
 * POST endpoints: they accept a `createdBy` attribution string that must not
 * be attacker-controlled.
 */

export async function getHistoryState(): Promise<HistoryState> {
  const auth = await requireAdmin();
  const supabase = createServiceClient();

  // Labels embed guest and party names, and lastEditedBy is an admin email,
  // so an unauthenticated caller gets nothing rather than a redacted view.
  if (auth.error) {
    return {
      canUndo: false,
      canRedo: false,
      undoLabel: null,
      redoLabel: null,
      lastEditedBy: null,
      lastEditedAt: null,
    };
  }

  return buildHistoryState(supabase);
}

async function step(
  direction: "undo" | "redo"
): Promise<{ error?: string; history?: HistoryState }> {
  const auth = await requireAdmin();
  if (auth.error) return { error: auth.error };

  const supabase = createServiceClient();

  const [pointerResult, snapshotsResult] = await Promise.all([
    supabase
      .from("seating_history_pointer")
      .select("current_seq")
      .eq("id", true)
      .maybeSingle(),
    supabase
      .from("seating_snapshots")
      .select("seq")
      .order("seq", { ascending: true }),
  ]);

  const snapshots = snapshotsResult.data ?? [];
  const currentSeq = pointerResult.data?.current_seq ?? null;
  const index = snapshots.findIndex((s) => s.seq === currentSeq);

  const targetIndex = direction === "undo" ? index - 1 : index + 1;

  if (index < 0 || targetIndex < 0 || targetIndex >= snapshots.length) {
    return {
      error: direction === "undo" ? "Nothing to undo." : "Nothing to redo.",
    };
  }

  const targetSeq = snapshots[targetIndex].seq;

  const { data: target } = await supabase
    .from("seating_snapshots")
    .select("state")
    .eq("seq", targetSeq)
    .single();

  if (!target) return { error: "That history entry is missing." };

  const restore = await restoreFloorPlan(
    supabase,
    target.state as FloorPlanState
  );
  if (restore.error) return { error: restore.error };

  // The pointer moves but no snapshot is added: undo/redo navigate history,
  // they don't create it. Only a real edit appends (and truncates the redo
  // branch), which is what makes redo survive an undo.
  await supabase
    .from("seating_history_pointer")
    .update({ current_seq: targetSeq, updated_at: new Date().toISOString() })
    .eq("id", true);

  revalidatePath(SEATING_PATH);
  return { history: await buildHistoryState(supabase) };
}

export async function undoSeating() {
  return step("undo");
}

export async function redoSeating() {
  return step("redo");
}
