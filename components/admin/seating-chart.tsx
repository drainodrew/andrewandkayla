"use client";

import { useState, useMemo, useRef, useEffect, useTransition } from "react";
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
} from "@/lib/actions/seating";

/** Padding around the tent in the viewBox so the outline isn't clipped. */
const PAD_FT = 3;

export function SeatingChart({
  objects,
  assignments,
  guests,
}: {
  objects: FloorObject[];
  assignments: SeatedGuest[];
  guests: AttendingGuest[];
}) {
  // Local copy so dragging is instant. Server is the source of truth for
  // everything else; positions sync back on the next revalidate.
  const [localObjects, setLocalObjects] = useState(objects);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [targetSeat, setTargetSeat] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<{ id: string; dx: number; dy: number } | null>(null);

  useEffect(() => {
    setLocalObjects(objects);
  }, [objects]);

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

  function halfExtent(obj: FloorObject) {
    if (obj.kind === "round_table") {
      return (obj.diameter_ft ?? ROUND_TABLE_DIAMETER_FT) / 2;
    }
    return Math.max(obj.width_ft ?? 0, obj.height_ft ?? 0) / 2;
  }

  function handlePointerDown(e: React.PointerEvent, obj: FloorObject) {
    e.stopPropagation();
    setSelectedId(obj.id);
    setTargetSeat(null);
    const p = clientToFeet(e.clientX, e.clientY);
    dragRef.current = { id: obj.id, dx: p.x - obj.x_ft, dy: p.y - obj.y_ft };
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function handlePointerMove(e: React.PointerEvent, obj: FloorObject) {
    const drag = dragRef.current;
    if (!drag || drag.id !== obj.id) return;
    const p = clientToFeet(e.clientX, e.clientY);
    const half = halfExtent(obj);
    const x = snapAndClamp(p.x - drag.dx, half, TENT_WIDTH_FT - half);
    const y = snapAndClamp(p.y - drag.dy, half, TENT_DEPTH_FT - half);
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
    // Fire and forget; this action intentionally doesn't revalidate.
    void updateObjectPosition(obj.id, current.x_ft, current.y_ft);
  }

  // ---- action helpers ------------------------------------------------

  function run(fn: () => Promise<{ error?: string } | void>) {
    setError(null);
    startTransition(async () => {
      const result = await fn();
      if (result && "error" in result && result.error) setError(result.error);
    });
  }

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
    <div className="max-w-[1600px]">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
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

      {/* Stats bar */}
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
          <div className="bg-white rounded-xl border border-sage/30 p-3">
            <svg
              ref={svgRef}
              viewBox={`${-PAD_FT} ${-PAD_FT} ${TENT_WIDTH_FT + PAD_FT * 2} ${
                TENT_DEPTH_FT + PAD_FT * 2
              }`}
              className="w-full h-auto touch-none select-none"
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

        {obj.kind === "round_table" && (
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
