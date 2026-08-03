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

export const HEAD_TABLE_DEPTH_FT = 2.5;

/**
 * Elbow room per person along a head table. Banquet rentals assume 24" per
 * seat on a rectangular table, which is why a 6ft table is sold as seating 3
 * per side.
 */
export const HEAD_TABLE_SEAT_PITCH_FT = 2;

export const MIN_HEAD_TABLE_SEATS = 1;
/** Matches the seat_count check constraint on floor_plan_objects. */
export const MAX_HEAD_TABLE_SEATS = 12;

/**
 * How a head table's seats are distributed around its perimeter.
 *
 * People sit on BOTH long sides and at the ends, not just the side facing the
 * room. That changes the arithmetic a lot: 12 seats along one side needs a
 * 24ft table, but 12 around the perimeter needs only 10ft, which is the
 * difference between fitting in the tent and not.
 *
 * A 30"-deep table takes exactly one person at each end. Everyone else splits
 * between the two long sides, with the odd one going to the front (the side
 * facing the room) so the couple is never the short row.
 *
 * Two or fewer stays a sweetheart table: both on the front side, side by
 * side, nobody with their back to the room.
 */
export function headTableSeatLayout(seatCount: number): {
  front: number;
  back: number;
  ends: number;
} {
  if (seatCount <= 0) return { front: 0, back: 0, ends: 0 };
  if (seatCount <= 2) return { front: seatCount, back: 0, ends: 0 };

  // Below 4 there aren't enough people to justify burning two on the ends.
  const ends = seatCount >= 4 ? 2 : 0;
  const remaining = seatCount - ends;
  const front = Math.ceil(remaining / 2);
  return { front, back: remaining - front, ends };
}

/**
 * A head table's width is derived from its seat count, not set independently.
 *
 * Otherwise people get crammed onto a fixed-width table, which renders as
 * overlapping seat markers and would be wrong if anyone measured off the
 * plan. Width is driven by the busier long side.
 */
export function headTableWidthFor(seatCount: number): number {
  const { front, back } = headTableSeatLayout(seatCount);
  const perSide = Math.max(front, back);
  return Math.max(4, perSide * HEAD_TABLE_SEAT_PITCH_FT);
}

/** Default sweetheart table: just the two of you. */
export const DEFAULT_HEAD_TABLE_SEATS = 2;
export const HEAD_TABLE_WIDTH_FT = headTableWidthFor(DEFAULT_HEAD_TABLE_SEATS);

/** Drag snapping. Half a foot is fine enough to look deliberate. */
export const SNAP_FT = 0.5;

export type FloorObjectKind = "round_table" | "head_table";

export interface FloorObject {
  id: string;
  kind: FloorObjectKind;
  label: string;
  /** Planning-only shorthand, e.g. "UNC friends". Not guest-facing. */
  internal_name: string | null;
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
 * Offsets for seats around a rectangular head table: both long sides plus
 * the two ends.
 *
 * Numbered as a walk around the perimeter, front-left to front-right, round
 * the right end, back along the far side, then the left end. Reading seat
 * numbers off the plan then matches walking around the table.
 */
export function headTableSeatOffsets(
  seatCount: number,
  widthFt: number,
  depthFt: number
): { x: number; y: number; angleDeg: number }[] {
  if (seatCount <= 0) return [];

  const { front, back, ends } = headTableSeatLayout(seatCount);
  const offset = 1.1; // how far a chair sits off the table edge
  const seats: { x: number; y: number; angleDeg: number }[] = [];

  // Spread n seats evenly along the table's width, inset so the outermost
  // chairs don't hang off the corners.
  const alongWidth = (n: number) => {
    if (n <= 0) return [];
    const usable = Math.max(0, widthFt - 1);
    if (n === 1) return [0];
    const step = usable / (n - 1);
    return Array.from({ length: n }, (_, i) => -usable / 2 + step * i);
  };

  // Front side (facing the room), left to right.
  for (const x of alongWidth(front)) {
    seats.push({ x, y: depthFt / 2 + offset, angleDeg: 90 });
  }

  // Right end.
  if (ends > 0) {
    seats.push({ x: widthFt / 2 + offset, y: 0, angleDeg: 0 });
  }

  // Back side, right to left so the numbering keeps circling.
  for (const x of alongWidth(back).reverse()) {
    seats.push({ x, y: -depthFt / 2 - offset, angleDeg: -90 });
  }

  // Left end.
  if (ends > 1) {
    seats.push({ x: -widthFt / 2 - offset, y: 0, angleDeg: 180 });
  }

  return seats;
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

/**
 * Initials for a seat marker on the floor plan.
 *
 * Two characters max: at the scale a seat renders (a ~1.4ft circle in a 60ft
 * tent) anything longer turns to mush. Falls back to one character when a
 * guest has no usable last name, which happens with the "Guest of X"
 * placeholder rows from the CSV import.
 */
export function initialsFor(guest: {
  first_name: string;
  last_name: string;
}): string {
  const letters = (value: string) => value.replace(/[^\p{L}]/gu, "");
  const first = letters(guest.first_name).charAt(0).toUpperCase();
  const last = letters(guest.last_name).charAt(0).toUpperCase();
  return `${first}${last}` || "?";
}

/**
 * Shorten a group name for display on the floor plan.
 *
 * A 60" round is only 5ft across on a to-scale plan, so anything much past a
 * dozen characters runs out past the table edge and collides with the seat
 * markers. The full name still shows in the side panel; this is only the
 * on-canvas label.
 */
export function truncateForPlan(name: string, maxChars = 12): string {
  const trimmed = name.trim();
  if (trimmed.length <= maxChars) return trimmed;
  return `${trimmed.slice(0, maxChars - 1).trimEnd()}...`;
}

/** Snap a raw foot value to the grid and keep it inside the tent. */
export function snapAndClamp(value: number, min: number, max: number): number {
  const snapped = Math.round(value / SNAP_FT) * SNAP_FT;
  return Math.min(max, Math.max(min, snapped));
}

/**
 * Half-extents of the space an object consumes, including pulled-out chairs
 * and walking room.
 *
 * Modelled as a box rather than a circle. A circumscribed circle is fine for
 * a round table but badly wrong for a long head table: a 24ft-wide one would
 * claim a ~14ft radius and flag most of the tent as crowded, training you to
 * ignore the warning. Rotation is ignored (this is axis-aligned), which is
 * acceptable because the warning is advisory, not a constraint.
 */
export function clearanceHalfExtents(obj: FloorObject): {
  x: number;
  y: number;
} {
  if (obj.kind === "round_table") {
    const r = (obj.diameter_ft ?? ROUND_TABLE_DIAMETER_FT) / 2;
    return {
      x: r + ROUND_TABLE_CLEARANCE_FT,
      y: r + ROUND_TABLE_CLEARANCE_FT,
    };
  }
  return {
    x: (obj.width_ft ?? HEAD_TABLE_WIDTH_FT) / 2 + ROUND_TABLE_CLEARANCE_FT,
    y: (obj.height_ft ?? HEAD_TABLE_DEPTH_FT) / 2 + ROUND_TABLE_CLEARANCE_FT,
  };
}

/**
 * Objects whose clearance boxes overlap, i.e. guests would be back to back
 * with no room to walk. Surfaced in red rather than blocked, because
 * sometimes you genuinely want two tables pushed together.
 *
 * Two round tables exactly one footprint (10ft) apart do NOT count as
 * crowded, so the generated grid starts clean.
 */
export function findCrowdedPairs(objects: FloorObject[]): Set<string> {
  const crowded = new Set<string>();
  for (let i = 0; i < objects.length; i++) {
    for (let j = i + 1; j < objects.length; j++) {
      const a = objects[i];
      const b = objects[j];
      const ea = clearanceHalfExtents(a);
      const eb = clearanceHalfExtents(b);
      const overlapsX = Math.abs(a.x_ft - b.x_ft) < ea.x + eb.x;
      const overlapsY = Math.abs(a.y_ft - b.y_ft) < ea.y + eb.y;
      if (overlapsX && overlapsY) {
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
