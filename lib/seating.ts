/**
 * Seating chart geometry. Pure functions and constants, no I/O, so both the
 * server actions and the client floor plan can import it.
 *
 * Everything here is in FEET. The SVG viewBox in the admin UI is literally
 * the tent in feet, which means a circle of r=2.5 on screen is a real 60"
 * round table. No pixel-to-foot conversion constant to get wrong.
 */

/** Tent is 50ft x 60ft. Rendered landscape: 60 across, 50 deep. */
export const TENT_WIDTH_FT = 60;
export const TENT_DEPTH_FT = 50;

/** 60" round = 5ft diameter. */
export const ROUND_TABLE_DIAMETER_FT = 5;

/**
 * Space a seated guest plus walking room needs beyond the table edge.
 * A chair pulled out is ~1.5ft; event planners add another ~1ft of aisle.
 * This makes each 60" round occupy a 10ft circle, which is the number that
 * actually decides how many tables fit in the tent.
 */
export const ROUND_TABLE_CLEARANCE_FT = 2.5;

/** Full footprint diameter including chairs and aisle: 10ft. */
export const ROUND_TABLE_FOOTPRINT_FT =
  ROUND_TABLE_DIAMETER_FT + ROUND_TABLE_CLEARANCE_FT * 2;

export const DEFAULT_SEAT_COUNT = 8;
/** The squeeze option. 9 at a 60" round is tight but survivable. */
export const MAX_SEAT_COUNT = 9;

export const HEAD_TABLE_WIDTH_FT = 8;
export const HEAD_TABLE_DEPTH_FT = 2.5;

/** Drag snapping. Half a foot is fine enough to look deliberate. */
export const SNAP_FT = 0.5;

export type FloorObjectKind = "round_table" | "head_table";

export interface FloorObject {
  id: string;
  kind: FloorObjectKind;
  label: string;
  x_ft: number;
  y_ft: number;
  rotation_deg: number;
  seat_count: number;
  diameter_ft: number | null;
  width_ft: number | null;
  height_ft: number | null;
  sort_order: number;
}

export interface SeatedGuest {
  guest_id: string;
  object_id: string;
  seat_number: number | null;
}

export interface AttendingGuest {
  id: string;
  first_name: string;
  last_name: string;
  party_id: string;
  party_name: string;
}

/**
 * Offsets (from the object's center, in feet) for each seat around a round
 * table. Seat 1 sits at 12 o'clock and they run clockwise, so the numbering
 * on screen matches how you'd read it walking around the table.
 */
export function roundSeatOffsets(
  seatCount: number,
  diameterFt: number
): { x: number; y: number; angleDeg: number }[] {
  if (seatCount <= 0) return [];
  // Seat markers sit just outside the table edge, where a chair back would be.
  const radius = diameterFt / 2 + 1.1;
  return Array.from({ length: seatCount }, (_, i) => {
    const angleDeg = (360 / seatCount) * i - 90; // -90 puts seat 1 at the top
    const rad = (angleDeg * Math.PI) / 180;
    return {
      x: Math.cos(rad) * radius,
      y: Math.sin(rad) * radius,
      angleDeg,
    };
  });
}

/**
 * Offsets for seats along one side of a rectangular head table (guests face
 * the room, so nobody is seated on the back edge).
 */
export function headTableSeatOffsets(
  seatCount: number,
  widthFt: number,
  depthFt: number
): { x: number; y: number; angleDeg: number }[] {
  if (seatCount <= 0) return [];
  const usable = widthFt - 1;
  const step = seatCount > 1 ? usable / (seatCount - 1) : 0;
  const startX = seatCount > 1 ? -usable / 2 : 0;
  return Array.from({ length: seatCount }, (_, i) => ({
    x: startX + step * i,
    y: depthFt / 2 + 1.1,
    angleDeg: 90,
  }));
}

export function seatOffsetsFor(
  obj: FloorObject
): { x: number; y: number; angleDeg: number }[] {
  if (obj.kind === "round_table") {
    return roundSeatOffsets(
      obj.seat_count,
      obj.diameter_ft ?? ROUND_TABLE_DIAMETER_FT
    );
  }
  return headTableSeatOffsets(
    obj.seat_count,
    obj.width_ft ?? HEAD_TABLE_WIDTH_FT,
    obj.height_ft ?? HEAD_TABLE_DEPTH_FT
  );
}

/** Snap a raw foot value to the grid and keep it inside the tent. */
export function snapAndClamp(value: number, min: number, max: number): number {
  const snapped = Math.round(value / SNAP_FT) * SNAP_FT;
  return Math.min(max, Math.max(min, snapped));
}

/**
 * Radius of the space an object actually consumes, including pulled-out
 * chairs and walking room. Rectangles are approximated by their circumscribed
 * circle, which is conservative (it over-reserves the corners) but that errs
 * toward flagging a collision rather than missing one.
 */
export function effectiveRadiusFt(obj: FloorObject): number {
  if (obj.kind === "round_table") {
    return (obj.diameter_ft ?? ROUND_TABLE_DIAMETER_FT) / 2 + ROUND_TABLE_CLEARANCE_FT;
  }
  const w = obj.width_ft ?? HEAD_TABLE_WIDTH_FT;
  const d = obj.height_ft ?? HEAD_TABLE_DEPTH_FT;
  return Math.sqrt(w * w + d * d) / 2 + ROUND_TABLE_CLEARANCE_FT;
}

/**
 * Objects sitting closer than their combined footprints, i.e. guests would be
 * back to back with no room to walk. Surfaced in the UI in red rather than
 * blocked, because sometimes you genuinely want two tables pushed together.
 *
 * Covers the head table too: its default spot is the most likely thing to
 * collide with a generated grid of round tables.
 */
export function findCrowdedPairs(objects: FloorObject[]): Set<string> {
  const crowded = new Set<string>();
  for (let i = 0; i < objects.length; i++) {
    for (let j = i + 1; j < objects.length; j++) {
      const a = objects[i];
      const b = objects[j];
      const dx = a.x_ft - b.x_ft;
      const dy = a.y_ft - b.y_ft;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance < effectiveRadiusFt(a) + effectiveRadiusFt(b)) {
        crowded.add(a.id);
        crowded.add(b.id);
      }
    }
  }
  return crowded;
}

/**
 * Grid positions for auto-laying out N round tables, at one footprint pitch
 * so nothing starts out crowded. Returns as many positions as fit.
 */
export function autoLayoutPositions(count: number): { x: number; y: number }[] {
  const pitch = ROUND_TABLE_FOOTPRINT_FT;
  const cols = Math.floor(TENT_WIDTH_FT / pitch);
  const rows = Math.floor(TENT_DEPTH_FT / pitch);

  // Center the whole grid in the tent rather than hugging the top-left.
  const gridWidth = cols * pitch;
  const gridDepth = rows * pitch;
  const originX = (TENT_WIDTH_FT - gridWidth) / 2 + pitch / 2;
  const originY = (TENT_DEPTH_FT - gridDepth) / 2 + pitch / 2;

  const positions: { x: number; y: number }[] = [];
  for (let row = 0; row < rows && positions.length < count; row++) {
    for (let col = 0; col < cols && positions.length < count; col++) {
      positions.push({
        x: originX + col * pitch,
        y: originY + row * pitch,
      });
    }
  }
  return positions;
}

/** How many round tables the tent can hold at a comfortable pitch. */
export const MAX_ROUND_TABLES =
  Math.floor(TENT_WIDTH_FT / ROUND_TABLE_FOOTPRINT_FT) *
  Math.floor(TENT_DEPTH_FT / ROUND_TABLE_FOOTPRINT_FT);
