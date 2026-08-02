"use client";

import {
  useState,
  useMemo,
  useRef,
  useEffect,
  useCallback,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";
import {
  TENT_WIDTH_FT,
  TENT_DEPTH_FT,
  ROUND_TABLE_DIAMETER_FT,
  ROUND_TABLE_FOOTPRINT_FT,
  HEAD_TABLE_WIDTH_FT,
  HEAD_TABLE_DEPTH_FT,
  DEFAULT_SEAT_COUNT,
  MAX_SEAT_COUNT,
  MAX_ROUND_TABLES,
  MIN_HEAD_TABLE_SEATS,
  MAX_HEAD_TABLE_SEATS,
  headTableWidthFor,
  seatOffsetsFor,
  snapAndClamp,
  findCrowdedPairs,
  type FloorObject,
  type SeatedGuest,
  type AttendingGuest,
} from "@/lib/seating";
import {
  addRoundTable,
  addHeadTable,
  generateRoundTables,
  updateObjectPosition,
  updateObject,
  deleteObject,
  assignSeat,
  unassignSeat,
  seatPartyAtTable,
  clearTable,
  type MutationResult,
} from "@/lib/actions/seating";
import { undoSeating, redoSeating } from "@/lib/actions/seating-history";
import type { HistoryState } from "@/lib/seating-history-core";

/** Padding around the tent in the viewBox so the outline isn't clipped. */
const PAD_FT = 3;

/**
 * Autosave indicator state. Every edit writes to Supabase immediately, so
 * there is no "unsaved" state to worry about; this exists purely so you can
 * SEE that, and so a failed write is loud instead of silent.
 */
type SaveStatus = "idle" | "saving" | "saved" | "error";

export function SeatingChart({
  objects,
  assignments,
  guests,
  history,
}: {
  objects: FloorObject[];
  assignments: SeatedGuest[];
  guests: AttendingGuest[];
  history: HistoryState;
}) {
  const router = useRouter();
  // Local copy so dragging is instant. Server is the source of truth for
  // everything else; positions sync back on the next revalidate.
  const [localObjects, setLocalObjects] = useState(objects);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [targetSeat, setTargetSeat] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [expanded, setExpanded] = useState(false);

  // History arrives from the server on every revalidate, but drag saves
  // deliberately skip revalidation, so we keep a local copy the actions can
  // update directly.
  const [historyState, setHistoryState] = useState(history);
  useEffect(() => setHistoryState(history), [history]);

  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<{
    id: string;
    dx: number;
    dy: number;
    /** Position when the drag started, to detect a no-op click. */
    originX: number;
    originY: number;
  } | null>(null);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setLocalObjects(objects);
  }, [objects]);

  // Clear the pending "Saved" fade timer if the component unmounts mid-flight.
  useEffect(() => {
    return () => {
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    };
  }, []);

  const guestById = useMemo(
    () => new Map(guests.map((g) => [g.id, g])),
    [guests]
  );

  const assignmentByGuest = useMemo(
    () => new Map(assignments.map((a) => [a.guest_id, a])),
    [assignments]
  );

  /** objectId -> assignments at that object */
  const assignmentsByObject = useMemo(() => {
    const map = new Map<string, SeatedGuest[]>();
    for (const a of assignments) {
      const list = map.get(a.object_id) ?? [];
      list.push(a);
      map.set(a.object_id, list);
    }
    return map;
  }, [assignments]);

  /** "objectId:seatNumber" -> guest sitting there */
  const occupantBySeat = useMemo(() => {
    const map = new Map<string, AttendingGuest>();
    for (const a of assignments) {
      if (a.seat_number === null) continue;
      const guest = guestById.get(a.guest_id);
      if (guest) map.set(`${a.object_id}:${a.seat_number}`, guest);
    }
    return map;
  }, [assignments, guestById]);

  const unseated = useMemo(
    () => guests.filter((g) => !assignmentByGuest.has(g.id)),
    [guests, assignmentByGuest]
  );

  const crowded = useMemo(() => findCrowdedPairs(localObjects), [localObjects]);

  const selected = localObjects.find((o) => o.id === selectedId) ?? null;

  const totalSeats = localObjects.reduce((sum, o) => sum + o.seat_count, 0);
  const roundTableCount = localObjects.filter(
    (o) => o.kind === "round_table"
  ).length;

  /**
   * Parties that ended up split across multiple tables. Not an error (you
   * sometimes have to split a big family), but you almost never want it by
   * accident, so it gets surfaced.
   */
  const splitParties = useMemo(() => {
    const tablesByParty = new Map<string, Set<string>>();
    for (const a of assignments) {
      const guest = guestById.get(a.guest_id);
      if (!guest) continue;
      const set = tablesByParty.get(guest.party_id) ?? new Set<string>();
      set.add(a.object_id);
      tablesByParty.set(guest.party_id, set);
    }
    return [...tablesByParty.entries()]
      .filter(([, tables]) => tables.size > 1)
      .map(([partyId]) => partyId);
  }, [assignments, guestById]);

  // ---- drag handling -------------------------------------------------

  function clientToFeet(clientX: number, clientY: number) {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const point = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse());
    return { x: point.x, y: point.y };
  }

  /**
   * Half-extents per axis, used to keep a dragged object inside the tent.
   * Per-axis rather than a single number: a 24ft-wide head table is only
   * 2.5ft deep, and clamping its vertical range by its width would lock it
   * out of most of the tent.
   */
  function halfExtents(obj: FloorObject) {
    if (obj.kind === "round_table") {
      const r = (obj.diameter_ft ?? ROUND_TABLE_DIAMETER_FT) / 2;
      return { x: r, y: r };
    }
    return {
      x: (obj.width_ft ?? 0) / 2,
      y: (obj.height_ft ?? 0) / 2,
    };
  }

  function handlePointerDown(e: React.PointerEvent, obj: FloorObject) {
    e.stopPropagation();
    setSelectedId(obj.id);
    setTargetSeat(null);
    const p = clientToFeet(e.clientX, e.clientY);
    dragRef.current = {
      id: obj.id,
      dx: p.x - obj.x_ft,
      dy: p.y - obj.y_ft,
      originX: obj.x_ft,
      originY: obj.y_ft,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function handlePointerMove(e: React.PointerEvent, obj: FloorObject) {
    const drag = dragRef.current;
    if (!drag || drag.id !== obj.id) return;
    const p = clientToFeet(e.clientX, e.clientY);
    const half = halfExtents(obj);
    const x = snapAndClamp(p.x - drag.dx, half.x, TENT_WIDTH_FT - half.x);
    const y = snapAndClamp(p.y - drag.dy, half.y, TENT_DEPTH_FT - half.y);
    setLocalObjects((prev) =>
      prev.map((o) => (o.id === obj.id ? { ...o, x_ft: x, y_ft: y } : o))
    );
  }

  function handlePointerUp(e: React.PointerEvent, obj: FloorObject) {
    const drag = dragRef.current;
    if (!drag || drag.id !== obj.id) return;
    dragRef.current = null;
    e.currentTarget.releasePointerCapture(e.pointerId);

    const current = localObjects.find((o) => o.id === obj.id);
    if (!current) return;

    // Only save if the table actually moved. A plain click to select a table
    // would otherwise write a no-op and pile up junk undo entries. Compared
    // against the drag's origin, not against `obj`, which is already the
    // updated local copy.
    if (current.x_ft === drag.originX && current.y_ft === drag.originY) return;

    run(() => updateObjectPosition(obj.id, current.x_ft, current.y_ft));
  }

  // ---- action helpers ------------------------------------------------

  /**
   * Run a mutation, tracking save state so the UI can show that the write
   * landed. Every action here persists immediately; this wrapper is what
   * makes that visible instead of merely true.
   */
  const run = useCallback(
    (fn: () => Promise<MutationResult>) => {
      setError(null);
      setSaveStatus("saving");
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);

      startTransition(async () => {
        try {
          const result = await fn();
          if (result.error) {
            setError(result.error);
            setSaveStatus("error");
            return;
          }
          if (result.history) setHistoryState(result.history);
          setSaveStatus("saved");
          // Fade the confirmation rather than leaving it up forever.
          savedTimerRef.current = setTimeout(() => setSaveStatus("idle"), 2000);
        } catch {
          // Network dropped, deploy mid-request, etc. Previously this was a
          // silent failure on drags; now it surfaces.
          setError("Couldn't reach the server. Your last change may not have saved.");
          setSaveStatus("error");
        }
      });
    },
    []
  );

  const handleUndo = useCallback(() => {
    run(async () => {
      const result = await undoSeating();
      if (result.history) setHistoryState(result.history);
      router.refresh();
      return result;
    });
  }, [run, router]);

  const handleRedo = useCallback(() => {
    run(async () => {
      const result = await redoSeating();
      if (result.history) setHistoryState(result.history);
      router.refresh();
      return result;
    });
  }, [run, router]);

  // Cmd/Ctrl+Z and Cmd/Ctrl+Shift+Z, skipped while typing in a field so
  // undo still means "undo my typing" inside the table-name input.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== "z") return;

      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }

      e.preventDefault();
      if (e.shiftKey) {
        if (historyState.canRedo) handleRedo();
      } else if (historyState.canUndo) {
        handleUndo();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [historyState.canUndo, historyState.canRedo, handleUndo, handleRedo]);

  // Escape leaves the expanded floor plan, or clears the selection.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      if (expanded) setExpanded(false);
      else setSelectedId(null);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [expanded]);

  // Delete/Backspace removes the selected table.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Delete" && e.key !== "Backspace") return;
      if (!selectedId) return;

      // Backspace is "delete a character" while typing, and on some browsers
      // it still triggers back-navigation. Never hijack it inside a field.
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }

      const table = localObjects.find((o) => o.id === selectedId);
      if (!table) return;

      e.preventDefault();

      // Deleting a seated table throws those guests back into the unseated
      // pile, which is a lot of work to lose to a stray keypress. Undo would
      // recover it, but a confirm is cheaper than discovering it later.
      const seated = (assignmentsByObject.get(selectedId) ?? []).length;
      if (seated > 0) {
        const ok = window.confirm(
          `Delete ${table.label}? ${seated} ${seated === 1 ? "person" : "people"} seated there will go back to unseated.`
        );
        if (!ok) return;
      }

      setSelectedId(null);
      run(() => deleteObject(table.id));
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedId, localObjects, assignmentsByObject, run]);

  function firstFreeSeat(obj: FloorObject): number | null {
    const taken = new Set(
      (assignmentsByObject.get(obj.id) ?? [])
        .map((a) => a.seat_number)
        .filter((n): n is number => n !== null)
    );
    for (let n = 1; n <= obj.seat_count; n++) {
      if (!taken.has(n)) return n;
    }
    return null;
  }

  function handleAssign(guest: AttendingGuest) {
    if (!selected) return;
    const seat = targetSeat ?? firstFreeSeat(selected);
    if (seat === null) {
      setError(`${selected.label} is full.`);
      return;
    }
    run(async () => {
      const result = await assignSeat(guest.id, selected.id, seat);
      // Release the explicit target so the next pick falls through to the
      // lowest empty chair. Lets you seat a whole table by clicking names.
      if (!result.error) setTargetSeat(null);
      return result;
    });
  }

  function exportCsv() {
    const headers = ["Table", "Seat", "Guest", "Party"];
    const rows: string[][] = [];

    const ordered = [...localObjects].sort(
      (a, b) => a.sort_order - b.sort_order || a.label.localeCompare(b.label)
    );

    for (const obj of ordered) {
      for (let n = 1; n <= obj.seat_count; n++) {
        const guest = occupantBySeat.get(`${obj.id}:${n}`);
        if (!guest) continue;
        rows.push([
          csvEscape(obj.label),
          String(n),
          csvEscape(`${guest.first_name} ${guest.last_name}`),
          csvEscape(guest.party_name),
        ]);
      }
      // People parked at the table with no chair chosen
      for (const a of assignmentsByObject.get(obj.id) ?? []) {
        if (a.seat_number !== null) continue;
        const guest = guestById.get(a.guest_id);
        if (!guest) continue;
        rows.push([
          csvEscape(obj.label),
          "",
          csvEscape(`${guest.first_name} ${guest.last_name}`),
          csvEscape(guest.party_name),
        ]);
      }
    }

    for (const guest of unseated) {
      rows.push([
        "UNSEATED",
        "",
        csvEscape(`${guest.first_name} ${guest.last_name}`),
        csvEscape(guest.party_name),
      ]);
    }

    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `seating-chart-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ---- render --------------------------------------------------------

  return (
    <div
      className={
        expanded
          ? // Fixed overlay so the plan uses the whole window. The sidebar and
            // page padding are behind it, which is the point.
            "fixed inset-0 z-40 bg-cream p-4 overflow-auto"
          : "max-w-[1600px]"
      }
    >
      {!expanded && (
        <div className="flex flex-wrap items-end justify-between gap-4 mb-4">
          <div>
            <h1 className="font-heading text-3xl text-deep-sage">Seating</h1>
            <p className="text-sm text-dark/60 mt-1">
              {TENT_WIDTH_FT}&prime; &times; {TENT_DEPTH_FT}&prime; tent &middot;{" "}
              {ROUND_TABLE_DIAMETER_FT * 12}&Prime; round tables &middot; drag to
              rearrange
            </p>
          </div>
          <button
            type="button"
            onClick={exportCsv}
            className="px-5 py-2.5 rounded-lg bg-pink text-dark text-sm font-medium hover:bg-pink/80 focus:outline-none focus:ring-2 focus:ring-pink focus:ring-offset-2 focus:ring-offset-cream transition-colors"
          >
            Export CSV
          </button>
        </div>
      )}

      {/* Undo/redo + autosave status */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <UndoRedoBar
          history={historyState}
          onUndo={handleUndo}
          onRedo={handleRedo}
          disabled={isPending}
        />
        <SaveIndicator status={saveStatus} history={historyState} />
      </div>

      {/* Stats bar. Hidden when expanded to give the plan the vertical room. */}
      {!expanded && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <Stat label="Attending" value={guests.length} />
          <Stat label="Seated" value={guests.length - unseated.length} />
          <Stat
            label="Unseated"
            value={unseated.length}
            tone={unseated.length > 0 ? "warn" : "ok"}
          />
          <Stat
            label="Seats available"
            value={totalSeats}
            tone={totalSeats < guests.length ? "warn" : "ok"}
          />
        </div>
      )}

      {totalSeats < guests.length && roundTableCount > 0 && (
        <Banner tone="warn">
          {guests.length - totalSeats} more seat
          {guests.length - totalSeats === 1 ? "" : "s"} needed. At{" "}
          {DEFAULT_SEAT_COUNT} per table that&apos;s{" "}
          {Math.ceil((guests.length - totalSeats) / DEFAULT_SEAT_COUNT)} more
          table
          {Math.ceil((guests.length - totalSeats) / DEFAULT_SEAT_COUNT) === 1
            ? ""
            : "s"}
          .
        </Banner>
      )}

      {crowded.size > 0 && (
        <Banner tone="warn">
          {crowded.size} table{crowded.size === 1 ? " is" : "s are"} closer than{" "}
          {ROUND_TABLE_FOOTPRINT_FT}&prime; apart (shown in red). Guests would be
          back to back with no room to walk between them.
        </Banner>
      )}

      {splitParties.length > 0 && (
        <Banner tone="info">
          {splitParties.length}{" "}
          {splitParties.length === 1 ? "party is" : "parties are"} split across
          more than one table.
        </Banner>
      )}

      {error && <Banner tone="error">{error}</Banner>}

      <div className="flex flex-col xl:flex-row gap-6">
        {/* Floor plan */}
        <div className="flex-1 min-w-0">
          <div className="bg-white rounded-xl border border-sage/30 p-3 relative">
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              title={
                expanded ? "Exit full screen (Esc)" : "Expand to full window"
              }
              aria-label={
                expanded ? "Exit full screen" : "Expand to full window"
              }
              className="absolute top-4 right-4 z-10 p-1.5 rounded-lg bg-white/90 border border-sage/40 text-dark/60 hover:text-deep-sage hover:border-sage transition-colors"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
              >
                {expanded ? (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25"
                  />
                ) : (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15"
                  />
                )}
              </svg>
            </button>
            <svg
              ref={svgRef}
              viewBox={`${-PAD_FT} ${-PAD_FT} ${TENT_WIDTH_FT + PAD_FT * 2} ${
                TENT_DEPTH_FT + PAD_FT * 2
              }`}
              // In expanded mode the plan should fill the viewport height.
              // preserveAspectRatio (default xMidYMid meet) keeps the tent
              // centered and undistorted inside whatever box it gets.
              className={`w-full h-auto touch-none select-none ${
                expanded ? "max-h-[calc(100vh-11rem)]" : ""
              }`}
              onPointerDown={() => {
                setSelectedId(null);
                setTargetSeat(null);
              }}
            >
              {/* 5ft grid */}
              <defs>
                <pattern
                  id="grid5"
                  width="5"
                  height="5"
                  patternUnits="userSpaceOnUse"
                >
                  <path
                    d="M 5 0 L 0 0 0 5"
                    fill="none"
                    stroke="#C5D0B3"
                    strokeWidth="0.06"
                    opacity="0.5"
                  />
                </pattern>
              </defs>

              <rect
                x="0"
                y="0"
                width={TENT_WIDTH_FT}
                height={TENT_DEPTH_FT}
                fill="url(#grid5)"
                stroke="#5C6B4E"
                strokeWidth="0.25"
                rx="0.5"
              />

              {/* Dimension labels */}
              <text
                x={TENT_WIDTH_FT / 2}
                y={-0.9}
                textAnchor="middle"
                fontSize="1.6"
                fill="#5C6B4E"
              >
                {TENT_WIDTH_FT}&prime;
              </text>
              <text
                x={-1.2}
                y={TENT_DEPTH_FT / 2}
                textAnchor="middle"
                fontSize="1.6"
                fill="#5C6B4E"
                transform={`rotate(-90 ${-1.2} ${TENT_DEPTH_FT / 2})`}
              >
                {TENT_DEPTH_FT}&prime;
              </text>

              {localObjects.map((obj) => (
                <FloorObjectShape
                  key={obj.id}
                  obj={obj}
                  isSelected={obj.id === selectedId}
                  isCrowded={crowded.has(obj.id)}
                  assignments={assignmentsByObject.get(obj.id) ?? []}
                  occupantBySeat={occupantBySeat}
                  onPointerDown={(e) => handlePointerDown(e, obj)}
                  onPointerMove={(e) => handlePointerMove(e, obj)}
                  onPointerUp={(e) => handlePointerUp(e, obj)}
                />
              ))}
            </svg>
          </div>

          {/* Floor plan controls */}
          <div className="flex flex-wrap gap-2 mt-3">
            <SmallButton onClick={() => run(addRoundTable)} disabled={isPending}>
              + Round table
            </SmallButton>
            <SmallButton onClick={() => run(addHeadTable)} disabled={isPending}>
              + Head table
            </SmallButton>
            {roundTableCount === 0 && (
              <SmallButton
                onClick={() =>
                  run(() =>
                    generateRoundTables(
                      Math.min(
                        Math.ceil(guests.length / DEFAULT_SEAT_COUNT),
                        MAX_ROUND_TABLES
                      )
                    )
                  )
                }
                disabled={isPending}
                primary
              >
                Generate{" "}
                {Math.min(
                  Math.ceil(guests.length / DEFAULT_SEAT_COUNT),
                  MAX_ROUND_TABLES
                )}{" "}
                tables for {guests.length} guests
              </SmallButton>
            )}
            <span className="text-xs text-dark/50 self-center ml-1">
              Tent fits {MAX_ROUND_TABLES} tables at a comfortable{" "}
              {ROUND_TABLE_FOOTPRINT_FT}&prime; spacing
            </span>
          </div>
        </div>

        {/* Side panel */}
        <div className="w-full xl:w-[26rem] shrink-0">
          {selected ? (
            <TablePanel
              obj={selected}
              assignments={assignmentsByObject.get(selected.id) ?? []}
              occupantBySeat={occupantBySeat}
              guestById={guestById}
              unseated={unseated}
              search={search}
              onSearch={setSearch}
              targetSeat={targetSeat}
              onTargetSeat={setTargetSeat}
              onAssign={handleAssign}
              onUnassign={(guestId) => run(() => unassignSeat(guestId))}
              onSeatParty={(partyId) =>
                run(() => seatPartyAtTable(partyId, selected.id))
              }
              onUpdate={(patch) => run(() => updateObject(selected.id, patch))}
              onClear={() => run(() => clearTable(selected.id))}
              onDelete={() => {
                setSelectedId(null);
                run(() => deleteObject(selected.id));
              }}
              isPending={isPending}
            />
          ) : (
            <UnseatedPanel
              unseated={unseated}
              search={search}
              onSearch={setSearch}
            />
          )}
        </div>
      </div>
    </div>
  );
}

/** One table or head table on the floor plan. */
function FloorObjectShape({
  obj,
  isSelected,
  isCrowded,
  assignments,
  occupantBySeat,
  onPointerDown,
  onPointerMove,
  onPointerUp,
}: {
  obj: FloorObject;
  isSelected: boolean;
  isCrowded: boolean;
  assignments: SeatedGuest[];
  occupantBySeat: Map<string, AttendingGuest>;
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerMove: (e: React.PointerEvent) => void;
  onPointerUp: (e: React.PointerEvent) => void;
}) {
  const seatOffsets = seatOffsetsFor(obj);
  const filled = assignments.length;
  const isRound = obj.kind === "round_table";
  const diameter = obj.diameter_ft ?? ROUND_TABLE_DIAMETER_FT;
  const width = obj.width_ft ?? HEAD_TABLE_WIDTH_FT;
  const depth = obj.height_ft ?? HEAD_TABLE_DEPTH_FT;

  const stroke = isCrowded ? "#C2410C" : isSelected ? "#5C6B4E" : "#C5D0B3";

  return (
    <g
      transform={`translate(${obj.x_ft} ${obj.y_ft}) rotate(${obj.rotation_deg})`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      style={{ cursor: "grab" }}
    >
      {/* Footprint ring: the space this table actually consumes once chairs
          are pulled out. Only drawn when selected, to avoid visual noise. */}
      {isSelected && isRound && (
        <circle
          r={ROUND_TABLE_FOOTPRINT_FT / 2}
          fill="none"
          stroke="#5C6B4E"
          strokeWidth="0.1"
          strokeDasharray="0.6 0.5"
          opacity="0.6"
        />
      )}

      {/* Seat markers */}
      {seatOffsets.map((offset, i) => {
        const seatNumber = i + 1;
        const occupant = occupantBySeat.get(`${obj.id}:${seatNumber}`);
        return (
          <circle
            key={seatNumber}
            cx={offset.x}
            cy={offset.y}
            r="0.62"
            fill={occupant ? "#F8BBDB" : "#FAF5EE"}
            stroke={occupant ? "#5C6B4E" : "#C5D0B3"}
            strokeWidth="0.09"
          />
        );
      })}

      {/* Table body */}
      {isRound ? (
        <circle
          r={diameter / 2}
          fill="#FFFFFF"
          stroke={stroke}
          strokeWidth={isSelected || isCrowded ? "0.28" : "0.16"}
        />
      ) : (
        <rect
          x={-width / 2}
          y={-depth / 2}
          width={width}
          height={depth}
          rx="0.3"
          fill="#FFFFFF"
          stroke={stroke}
          strokeWidth={isSelected ? "0.28" : "0.16"}
        />
      )}

      {/* Label and fill count, counter-rotated so text stays upright */}
      <g transform={`rotate(${-obj.rotation_deg})`}>
        <text
          textAnchor="middle"
          y={isRound ? -0.3 : -0.1}
          fontSize={isRound ? "1.25" : "1"}
          fontWeight="600"
          fill="#2A2A2A"
          style={{ pointerEvents: "none" }}
        >
          {obj.label}
        </text>
        <text
          textAnchor="middle"
          y={isRound ? 1.2 : 1.1}
          fontSize="1"
          fill={filled >= obj.seat_count ? "#5C6B4E" : "#2A2A2A"}
          opacity="0.65"
          style={{ pointerEvents: "none" }}
        >
          {filled}/{obj.seat_count}
        </text>
      </g>
    </g>
  );
}

/** Panel shown when a table is selected: edit it and seat people at it. */
function TablePanel({
  obj,
  assignments,
  occupantBySeat,
  guestById,
  unseated,
  search,
  onSearch,
  targetSeat,
  onTargetSeat,
  onAssign,
  onUnassign,
  onSeatParty,
  onUpdate,
  onClear,
  onDelete,
  isPending,
}: {
  obj: FloorObject;
  assignments: SeatedGuest[];
  occupantBySeat: Map<string, AttendingGuest>;
  guestById: Map<string, AttendingGuest>;
  unseated: AttendingGuest[];
  search: string;
  onSearch: (v: string) => void;
  targetSeat: number | null;
  onTargetSeat: (n: number | null) => void;
  onAssign: (guest: AttendingGuest) => void;
  onUnassign: (guestId: string) => void;
  onSeatParty: (partyId: string) => void;
  onUpdate: (patch: { label?: string; seat_count?: number }) => void;
  onClear: () => void;
  onDelete: () => void;
  isPending: boolean;
}) {
  const [labelDraft, setLabelDraft] = useState(obj.label);
  useEffect(() => setLabelDraft(obj.label), [obj.id, obj.label]);

  const freeSeatCount =
    obj.seat_count -
    assignments.filter((a) => a.seat_number !== null).length;

  const unnumbered = assignments.filter((a) => a.seat_number === null);

  const filteredUnseated = search.trim()
    ? unseated.filter((g) =>
        `${g.first_name} ${g.last_name} ${g.party_name}`
          .toLowerCase()
          .includes(search.toLowerCase().trim())
      )
    : unseated;

  // Group the unseated list by party, since that's how you actually seat.
  const parties = useMemo(() => {
    const map = new Map<string, { name: string; guests: AttendingGuest[] }>();
    for (const g of filteredUnseated) {
      const entry = map.get(g.party_id) ?? { name: g.party_name, guests: [] };
      entry.guests.push(g);
      map.set(g.party_id, entry);
    }
    return [...map.entries()].sort((a, b) =>
      a[1].name.localeCompare(b[1].name)
    );
  }, [filteredUnseated]);

  return (
    <div className="bg-white rounded-xl border border-sage/30 p-4 space-y-4">
      {/* Table settings */}
      <div className="space-y-3">
        <div>
          <label className="text-xs text-dark/50 block mb-1">Table name</label>
          <input
            value={labelDraft}
            onChange={(e) => setLabelDraft(e.target.value)}
            onBlur={() => {
              if (labelDraft.trim() && labelDraft !== obj.label) {
                onUpdate({ label: labelDraft });
              }
            }}
            className="w-full px-3 py-2 rounded-lg border border-sage/50 text-dark text-sm focus:outline-none focus:ring-2 focus:ring-pink focus:border-pink"
          />
        </div>

        {obj.kind === "round_table" ? (
          <div>
            <label className="text-xs text-dark/50 block mb-1">Seats</label>
            <div className="flex gap-2">
              {[DEFAULT_SEAT_COUNT, MAX_SEAT_COUNT].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => onUpdate({ seat_count: n })}
                  disabled={isPending}
                  className={`px-4 py-1.5 rounded-lg text-sm border transition-colors ${
                    obj.seat_count === n
                      ? "bg-pink/30 border-pink text-dark font-medium"
                      : "border-sage/50 text-dark/70 hover:bg-sage/10"
                  }`}
                >
                  {n}
                  {n === MAX_SEAT_COUNT && (
                    <span className="text-xs text-dark/50"> (tight)</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        ) : (
          // Head tables run anywhere from a sweetheart table for two to the
          // whole wedding party, so this is a stepper rather than a couple of
          // preset buttons.
          <div>
            <label className="text-xs text-dark/50 block mb-1">Seats</label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  onUpdate({ seat_count: obj.seat_count - 1 })
                }
                disabled={isPending || obj.seat_count <= MIN_HEAD_TABLE_SEATS}
                aria-label="Remove a seat"
                className="w-8 h-8 rounded-lg border border-sage/50 text-dark/70 hover:bg-sage/10 disabled:opacity-40 disabled:hover:bg-transparent transition-colors"
              >
                &minus;
              </button>
              <span className="w-8 text-center text-sm font-medium text-dark">
                {obj.seat_count}
              </span>
              <button
                type="button"
                onClick={() =>
                  onUpdate({ seat_count: obj.seat_count + 1 })
                }
                disabled={isPending || obj.seat_count >= MAX_HEAD_TABLE_SEATS}
                aria-label="Add a seat"
                className="w-8 h-8 rounded-lg border border-sage/50 text-dark/70 hover:bg-sage/10 disabled:opacity-40 disabled:hover:bg-transparent transition-colors"
              >
                +
              </button>
              <span className="text-xs text-dark/50 ml-1">
                {headTableWidthFor(obj.seat_count)}&prime; table
              </span>
            </div>
            {obj.seat_count >= MAX_HEAD_TABLE_SEATS && (
              <p className="text-xs text-dark/40 mt-1">
                Max {MAX_HEAD_TABLE_SEATS}. Add a second head table for more.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Seats */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-deep-sage">Seats</h3>
          <span className="text-xs text-dark/50">
            {obj.seat_count - freeSeatCount}/{obj.seat_count} filled
          </span>
        </div>
        <div className="space-y-1">
          {Array.from({ length: obj.seat_count }, (_, i) => i + 1).map((n) => {
            const occupant = occupantBySeat.get(`${obj.id}:${n}`);
            const isTarget = targetSeat === n;
            return (
              <div
                key={n}
                className={`flex items-center gap-2 px-2 py-1.5 rounded-lg border text-sm ${
                  isTarget
                    ? "border-pink bg-pink/10"
                    : "border-transparent hover:bg-sage/5"
                }`}
              >
                <span className="w-5 text-xs text-dark/40 shrink-0">{n}</span>
                {occupant ? (
                  <>
                    <span className="flex-1 min-w-0 truncate text-dark">
                      {occupant.first_name} {occupant.last_name}
                      <span className="text-dark/40 text-xs">
                        {" "}
                        &middot; {occupant.party_name}
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => onUnassign(occupant.id)}
                      disabled={isPending}
                      className="text-dark/30 hover:text-red-600 transition-colors shrink-0 px-1"
                      aria-label={`Remove ${occupant.first_name} from seat ${n}`}
                    >
                      &times;
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => onTargetSeat(isTarget ? null : n)}
                    className="flex-1 text-left text-dark/35 hover:text-deep-sage transition-colors"
                  >
                    {isTarget ? "Choose a guest below" : "Empty"}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {unnumbered.length > 0 && (
          <div className="mt-2 pt-2 border-t border-sage/20">
            <p className="text-xs text-dark/50 mb-1">At table, chair TBD</p>
            {unnumbered.map((a) => {
              const guest = guestById.get(a.guest_id);
              if (!guest) return null;
              return (
                <div key={a.guest_id} className="flex items-center gap-2 text-sm">
                  <span className="flex-1 truncate text-dark">
                    {guest.first_name} {guest.last_name}
                  </span>
                  <button
                    type="button"
                    onClick={() => onUnassign(guest.id)}
                    className="text-dark/30 hover:text-red-600 px-1"
                  >
                    &times;
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Guest picker */}
      <div>
        <h3 className="text-sm font-medium text-deep-sage mb-2">
          {targetSeat
            ? `Seat someone in chair ${targetSeat}`
            : `Add to ${obj.label}`}
        </h3>
        <input
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Search unseated guests..."
          className="w-full px-3 py-2 mb-2 rounded-lg border border-sage/50 text-dark text-sm placeholder:text-dark/40 focus:outline-none focus:ring-2 focus:ring-pink focus:border-pink"
        />

        <div className="max-h-80 overflow-y-auto space-y-2 pr-1">
          {parties.length === 0 ? (
            <p className="text-sm text-dark/40 py-2">
              {search.trim()
                ? "No unseated guests match."
                : "Everyone is seated."}
            </p>
          ) : (
            parties.map(([partyId, party]) => (
              <div
                key={partyId}
                className="border border-sage/20 rounded-lg px-2 py-1.5"
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-xs text-dark/50 truncate">
                    {party.name}
                  </span>
                  {party.guests.length > 1 &&
                    party.guests.length <= freeSeatCount && (
                      <button
                        type="button"
                        onClick={() => onSeatParty(partyId)}
                        disabled={isPending}
                        className="text-xs text-deep-sage hover:text-pink shrink-0 transition-colors"
                      >
                        Seat all {party.guests.length}
                      </button>
                    )}
                </div>
                {party.guests.map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => onAssign(g)}
                    disabled={isPending || freeSeatCount === 0}
                    className="w-full text-left px-2 py-1 rounded text-sm text-dark hover:bg-pink/15 disabled:opacity-40 disabled:hover:bg-transparent transition-colors"
                  >
                    {g.first_name} {g.last_name}
                  </button>
                ))}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Destructive actions */}
      <div className="flex gap-3 pt-3 border-t border-sage/20">
        <button
          type="button"
          onClick={onClear}
          disabled={isPending || assignments.length === 0}
          className="text-xs text-dark/50 hover:text-deep-sage disabled:opacity-40 transition-colors"
        >
          Clear table
        </button>
        <button
          type="button"
          onClick={onDelete}
          disabled={isPending}
          className="text-xs text-dark/50 hover:text-red-600 transition-colors"
        >
          Delete table
        </button>
      </div>
    </div>
  );
}

/** Panel shown when nothing is selected: who still needs a seat. */
function UnseatedPanel({
  unseated,
  search,
  onSearch,
}: {
  unseated: AttendingGuest[];
  search: string;
  onSearch: (v: string) => void;
}) {
  const filtered = search.trim()
    ? unseated.filter((g) =>
        `${g.first_name} ${g.last_name} ${g.party_name}`
          .toLowerCase()
          .includes(search.toLowerCase().trim())
      )
    : unseated;

  const parties = useMemo(() => {
    const map = new Map<string, { name: string; guests: AttendingGuest[] }>();
    for (const g of filtered) {
      const entry = map.get(g.party_id) ?? { name: g.party_name, guests: [] };
      entry.guests.push(g);
      map.set(g.party_id, entry);
    }
    return [...map.entries()].sort((a, b) => a[1].name.localeCompare(b[1].name));
  }, [filtered]);

  return (
    <div className="bg-white rounded-xl border border-sage/30 p-4">
      <h3 className="text-sm font-medium text-deep-sage mb-1">
        Not seated yet ({unseated.length})
      </h3>
      <p className="text-xs text-dark/50 mb-3">
        Click a table on the floor plan to start seating people at it.
      </p>
      <input
        value={search}
        onChange={(e) => onSearch(e.target.value)}
        placeholder="Search..."
        className="w-full px-3 py-2 mb-3 rounded-lg border border-sage/50 text-dark text-sm placeholder:text-dark/40 focus:outline-none focus:ring-2 focus:ring-pink focus:border-pink"
      />
      <div className="max-h-[32rem] overflow-y-auto space-y-2 pr-1">
        {parties.length === 0 ? (
          <p className="text-sm text-dark/40">
            {unseated.length === 0
              ? "Everyone has a seat."
              : "No guests match that search."}
          </p>
        ) : (
          parties.map(([partyId, party]) => (
            <div key={partyId}>
              <p className="text-xs text-dark/50">{party.name}</p>
              {party.guests.map((g) => (
                <p key={g.id} className="text-sm text-dark pl-2">
                  {g.first_name} {g.last_name}
                </p>
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/**
 * Undo/redo controls. Labels name the specific change ("Undo: Seat the Myers
 * party at Table 3") so you know what you're about to reverse, which matters
 * a lot when two admins are editing the same plan.
 */
function UndoRedoBar({
  history,
  onUndo,
  onRedo,
  disabled,
}: {
  history: HistoryState;
  onUndo: () => void;
  onRedo: () => void;
  disabled: boolean;
}) {
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={onUndo}
        disabled={disabled || !history.canUndo}
        title={
          history.undoLabel
            ? `Undo: ${history.undoLabel}`
            : "Nothing to undo"
        }
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-sage/50 text-sm text-dark/80 hover:bg-sage/10 disabled:opacity-40 disabled:hover:bg-transparent transition-colors"
      >
        <svg
          className="w-4 h-4"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3"
          />
        </svg>
        Undo
      </button>
      <button
        type="button"
        onClick={onRedo}
        disabled={disabled || !history.canRedo}
        title={
          history.redoLabel ? `Redo: ${history.redoLabel}` : "Nothing to redo"
        }
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-sage/50 text-sm text-dark/80 hover:bg-sage/10 disabled:opacity-40 disabled:hover:bg-transparent transition-colors"
      >
        <svg
          className="w-4 h-4"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15 15l6-6m0 0l-6-6m6 6H9a6 6 0 000 12h3"
          />
        </svg>
        Redo
      </button>
    </div>
  );
}

/**
 * Autosave status. There is no save button because there is nothing to save:
 * every edit is already written. This tells you that happened, and shouts if
 * a write failed.
 */
function SaveIndicator({
  status,
  history,
}: {
  status: SaveStatus;
  history: HistoryState;
}) {
  if (status === "saving") {
    return <span className="text-xs text-dark/50">Saving...</span>;
  }

  if (status === "error") {
    return (
      <span className="text-xs text-red-700 font-medium">
        Not saved, see the error below
      </span>
    );
  }

  if (status === "saved") {
    return <span className="text-xs text-deep-sage">All changes saved</span>;
  }

  if (history.lastEditedAt) {
    const who = history.lastEditedBy;
    return (
      <span className="text-xs text-dark/40">
        Saved automatically &middot; last edit{" "}
        {new Date(history.lastEditedAt).toLocaleString(undefined, {
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        })}
        {who ? ` by ${who}` : ""}
      </span>
    );
  }

  return (
    <span className="text-xs text-dark/40">Changes save automatically</span>
  );
}

function Stat({
  label,
  value,
  tone = "ok",
}: {
  label: string;
  value: number;
  tone?: "ok" | "warn";
}) {
  return (
    <div className="bg-white rounded-xl border border-sage/30 px-4 py-3">
      <p className="text-xs text-dark/50">{label}</p>
      <p
        className={`text-2xl font-heading ${
          tone === "warn" ? "text-orange-700" : "text-deep-sage"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function Banner({
  tone,
  children,
}: {
  tone: "warn" | "info" | "error";
  children: React.ReactNode;
}) {
  const styles = {
    warn: "bg-orange-50 border-orange-200 text-orange-900",
    info: "bg-sage/10 border-sage/40 text-deep-sage",
    error: "bg-red-50 border-red-200 text-red-800",
  }[tone];

  return (
    <div className={`mb-3 px-4 py-2.5 rounded-lg border text-sm ${styles}`}>
      {children}
    </div>
  );
}

function SmallButton({
  onClick,
  disabled,
  primary,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  primary?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`px-3 py-1.5 rounded-lg text-sm border transition-colors disabled:opacity-50 ${
        primary
          ? "bg-pink text-dark border-pink hover:bg-pink/80 font-medium"
          : "border-sage/50 text-dark/80 hover:bg-sage/10"
      }`}
    >
      {children}
    </button>
  );
}

function csvEscape(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
