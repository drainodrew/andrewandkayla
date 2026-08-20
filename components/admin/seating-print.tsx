import {
  TENT_WIDTH_FT,
  TENT_DEPTH_FT,
  ROUND_TABLE_DIAMETER_FT,
  HEAD_TABLE_WIDTH_FT,
  HEAD_TABLE_DEPTH_FT,
  headTableSeatLayout,
  compareFloorObjects,
  compareGuestsByLastName,
  type AttendingGuest,
  type FloorObject,
  type SeatedGuest,
} from "@/lib/seating";

/**
 * Printable seating chart: one page per table, names spelled out in the chair
 * they sit in, plus a mini floor plan showing where in the tent that table is.
 *
 * Why this is not the CSV: a spreadsheet can tell you Ava Bennett is in seat 3,
 * but whoever is placing 200 place cards on the day needs to see that seat 3 is
 * the chair to the right of the one at 12 o'clock. That is a picture, and a CSV
 * cannot draw one. The CSV is still there and still carries full names; this is
 * the thing you actually pin to the table.
 *
 * Deliberately NOT drawn to scale, unlike the admin floor plan. A 60" round is
 * 5ft across and a name bubble big enough to read "AnnaClaire Schenkel" is not
 * 5ft wide, so honouring the scale here would make the names illegible. The
 * seat POSITIONS keep the real convention (seat 1 at 12 o'clock, running
 * clockwise), so the printout and the on-screen plan agree about who sits
 * where even though the proportions differ.
 */

/** Radius of a name bubble, in the diagram's own units. */
const BUBBLE_R = 34;
/** Breathing room between adjacent bubbles. */
const BUBBLE_GAP = 7;
/** Gap between a bubble's edge and its seat number. */
const LABEL_GAP = 12;
const LABEL_FONT = 12;
/**
 * How much room the seat numbers add beyond the bubbles. The viewBox has to
 * include this or the outermost numbers are silently clipped off the edge of
 * the drawing, which is exactly what happened to seat 1 at 12 o'clock.
 */
const LABEL_ALLOWANCE = LABEL_GAP + LABEL_FONT;

/**
 * A seat's position plus the direction that points away from the table.
 *
 * The direction is what makes the numbers uniform. Drawing every number at
 * "bubble top" only reads correctly for the seat at 12 o'clock: at 4 o'clock
 * that same offset tucks the number inside the neighbouring bubble, and at the
 * top it pushes it clean off the canvas. Each number instead sits directly
 * outward from its own chair, the way you'd read them walking around the
 * table.
 */
interface PrintSeat {
  x: number;
  y: number;
  dirX: number;
  dirY: number;
}

interface SeatOccupant {
  seatNumber: number;
  guest: AttendingGuest | null;
}

/**
 * Font size that fits the longer of a guest's two names inside a bubble.
 *
 * First and last go on separate lines (as in the inspiration Kayla sent), so
 * only the longest single word has to fit, not the whole name. Without this,
 * "AnnaClaire" overflows its circle while "Amy Lee" floats in whitespace.
 */
function nameFontSize(first: string, last: string): number {
  const longest = Math.max(first.length, last.length, 1);
  // ~0.55em per character is a good approximation for Inter's average advance.
  const fitted = (BUBBLE_R * 1.75) / (longest * 0.55);
  return Math.max(7, Math.min(BUBBLE_R * 0.42, fitted));
}

/** Seat bubble positions for a round table, spread far enough not to collide. */
function roundPrintLayout(seatCount: number) {
  const circumferenceNeeded = (BUBBLE_R * 2 + BUBBLE_GAP) * Math.max(seatCount, 1);
  const ringR = Math.max(90, circumferenceNeeded / (2 * Math.PI));
  const tableR = Math.max(40, ringR - BUBBLE_R - 8);

  const seats: PrintSeat[] = Array.from({ length: seatCount }, (_, i) => {
    // -90deg puts seat 1 at 12 o'clock, matching roundSeatOffsets.
    const angle = ((360 / seatCount) * i - 90) * (Math.PI / 180);
    const dirX = Math.cos(angle);
    const dirY = Math.sin(angle);
    return { x: dirX * ringR, y: dirY * ringR, dirX, dirY };
  });

  const extent = ringR + BUBBLE_R + LABEL_ALLOWANCE;
  return {
    seats,
    tableR,
    viewBox: `${-extent} ${-extent} ${extent * 2} ${extent * 2}`,
  };
}

/**
 * Seat bubble positions for a head table: both long sides plus the ends,
 * the same walk-around-the-perimeter numbering the floor plan uses.
 */
function headPrintLayout(seatCount: number, widthFt: number, depthFt: number) {
  const { front, back, ends } = headTableSeatLayout(seatCount);

  // Scale so the busiest side's seats clear each other, then let the SVG shrink
  // the whole thing to the page width.
  const perSide = Math.max(front, back, 1);
  const usableFt = Math.max(widthFt - 1, 0.1);
  const spacingFt = perSide > 1 ? usableFt / (perSide - 1) : usableFt;
  const scale = Math.max(30, (BUBBLE_R * 2 + BUBBLE_GAP) / Math.max(spacingFt, 0.1));

  const halfW = (widthFt * scale) / 2;
  const halfD = Math.max((depthFt * scale) / 2, BUBBLE_R * 0.6);
  const offset = BUBBLE_R + 10;

  const alongWidth = (n: number) => {
    if (n <= 0) return [];
    const usable = usableFt * scale;
    if (n === 1) return [0];
    const step = usable / (n - 1);
    return Array.from({ length: n }, (_, i) => -usable / 2 + step * i);
  };

  // Outward is per-side, not radial: on a 12ft head table the far-left front
  // chair is mostly to the LEFT of centre, so a radial direction would throw
  // its number sideways into its neighbour instead of straight out front.
  const seats: PrintSeat[] = [];
  for (const x of alongWidth(front))
    seats.push({ x, y: halfD + offset, dirX: 0, dirY: 1 });
  if (ends > 0)
    seats.push({ x: halfW + offset, y: 0, dirX: 1, dirY: 0 });
  for (const x of alongWidth(back).reverse())
    seats.push({ x, y: -halfD - offset, dirX: 0, dirY: -1 });
  if (ends > 1)
    seats.push({ x: -halfW - offset, y: 0, dirX: -1, dirY: 0 });

  const extentX = halfW + offset + BUBBLE_R + LABEL_ALLOWANCE;
  const extentY = halfD + offset + BUBBLE_R + LABEL_ALLOWANCE;
  return {
    seats,
    halfW,
    halfD,
    viewBox: `${-extentX} ${-extentY} ${extentX * 2} ${extentY * 2}`,
  };
}

/** One name bubble, or an empty chair. */
function SeatBubble({
  seat,
  seatNumber,
  guest,
}: {
  seat: PrintSeat;
  seatNumber: number;
  guest: AttendingGuest | null;
}) {
  const { x, y, dirX, dirY } = seat;
  const size = guest ? nameFontSize(guest.first_name, guest.last_name) : 11;
  const labelDistance = BUBBLE_R + LABEL_GAP;

  return (
    <g>
      <circle
        cx={x}
        cy={y}
        r={BUBBLE_R}
        fill="#FFFFFF"
        stroke={guest ? "#5C6B4E" : "#C5D0B3"}
        strokeWidth={guest ? 1.6 : 1}
        strokeDasharray={guest ? undefined : "4 3"}
      />
      {/* Seat number, placed radially outward from the table so every one of
          them sits clear of its own bubble and its neighbours'. dominantBaseline
          centers it on the point rather than hanging it off a text baseline,
          which is what keeps them level with each other all the way round. */}
      <text
        x={x + dirX * labelDistance}
        y={y + dirY * labelDistance}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={LABEL_FONT}
        fontWeight="600"
        fill="#5C6B4E"
        opacity="0.8"
      >
        {seatNumber}
      </text>
      {guest ? (
        <>
          <text
            x={x}
            y={y - size * 0.15}
            textAnchor="middle"
            fontSize={size}
            fontWeight="600"
            fill="#2A2A2A"
          >
            {guest.first_name}
          </text>
          <text
            x={x}
            y={y + size * 1.05}
            textAnchor="middle"
            fontSize={size}
            fontWeight="600"
            fill="#2A2A2A"
          >
            {guest.last_name}
          </text>
        </>
      ) : (
        <text
          x={x}
          y={y + 4}
          textAnchor="middle"
          fontSize="11"
          fill="#C5D0B3"
        >
          open
        </text>
      )}
    </g>
  );
}

/**
 * Miniature of the whole tent with this table filled in, so whoever is setting
 * up knows which of 25 identical rounds this page belongs to. This is the
 * to-scale one; it's the equivalent of the venue photo in Kayla's reference.
 */
function TentLocator({
  objects,
  currentId,
}: {
  objects: FloorObject[];
  currentId: string;
}) {
  const pad = 2;
  return (
    <svg
      viewBox={`${-pad} ${-pad} ${TENT_WIDTH_FT + pad * 2} ${TENT_DEPTH_FT + pad * 2}`}
      className="w-full h-auto"
      aria-label="Where this table sits in the tent"
    >
      <rect
        x="0"
        y="0"
        width={TENT_WIDTH_FT}
        height={TENT_DEPTH_FT}
        fill="none"
        stroke="#5C6B4E"
        strokeWidth="0.3"
        rx="0.5"
      />
      {objects.map((o) => {
        const isCurrent = o.id === currentId;
        const common = {
          fill: isCurrent ? "#F8BBDB" : "#FFFFFF",
          stroke: isCurrent ? "#2A2A2A" : "#C5D0B3",
          strokeWidth: isCurrent ? 0.5 : 0.22,
        };
        return (
          <g
            key={o.id}
            transform={`translate(${o.x_ft} ${o.y_ft}) rotate(${o.rotation_deg})`}
          >
            {o.kind === "round_table" ? (
              <circle r={(o.diameter_ft ?? ROUND_TABLE_DIAMETER_FT) / 2} {...common} />
            ) : (
              <rect
                x={-(o.width_ft ?? HEAD_TABLE_WIDTH_FT) / 2}
                y={-(o.height_ft ?? HEAD_TABLE_DEPTH_FT) / 2}
                width={o.width_ft ?? HEAD_TABLE_WIDTH_FT}
                height={o.height_ft ?? HEAD_TABLE_DEPTH_FT}
                rx="0.3"
                {...common}
              />
            )}
            <g transform={`rotate(${-o.rotation_deg})`}>
              <text
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={isCurrent ? "1.5" : "1.2"}
                fontWeight={isCurrent ? "700" : "400"}
                fill="#2A2A2A"
                opacity={isCurrent ? 1 : 0.55}
              >
                {/* Just the number on the mini map; the full label is the
                    page heading and repeating it here turns to mush. */}
                {o.label.replace(/^Table\s*/i, "") || o.label}
              </text>
            </g>
          </g>
        );
      })}
    </svg>
  );
}

/** One printed page: a single table and everyone at it. */
function TablePage({
  obj,
  occupants,
  objects,
}: {
  obj: FloorObject;
  occupants: SeatOccupant[];
  objects: FloorObject[];
}) {
  const isRound = obj.kind === "round_table";
  const round = isRound ? roundPrintLayout(obj.seat_count) : null;
  const head = isRound
    ? null
    : headPrintLayout(
        obj.seat_count,
        obj.width_ft ?? HEAD_TABLE_WIDTH_FT,
        obj.height_ft ?? HEAD_TABLE_DEPTH_FT
      );

  const layout = round ?? head!;
  const seated = occupants.filter((o) => o.guest).length;

  return (
    <section className="print-page print-page--table">
      <header className="text-center mb-2">
        <h2 className="font-heading text-4xl tracking-wide text-dark uppercase">
          {obj.label}
        </h2>
        {obj.internal_name && (
          <p className="text-base text-deep-sage mt-0.5">{obj.internal_name}</p>
        )}
        <p className="text-xs text-dark/45 mt-0.5">
          {seated} of {obj.seat_count} seats filled
        </p>
      </header>

      <div className="mx-auto w-[34%] max-w-[2.4in] mb-1">
        <TentLocator objects={objects} currentId={obj.id} />
        <p className="text-center text-[9px] text-dark/40 mt-0.5">
          This table, shaded, in the {TENT_WIDTH_FT}&prime; &times;{" "}
          {TENT_DEPTH_FT}&prime; tent
        </p>
      </div>

      <svg viewBox={layout.viewBox} className="w-full h-auto max-h-[3.9in]">
        {round ? (
          <circle
            r={round.tableR}
            fill="#FFFFFF"
            stroke="#2A2A2A"
            strokeWidth="1.8"
          />
        ) : (
          <rect
            x={-head!.halfW}
            y={-head!.halfD}
            width={head!.halfW * 2}
            height={head!.halfD * 2}
            rx="4"
            fill="#FFFFFF"
            stroke="#2A2A2A"
            strokeWidth="1.8"
          />
        )}
        {layout.seats.map((seat, i) => (
          <SeatBubble
            key={i}
            seat={seat}
            seatNumber={i + 1}
            guest={occupants[i]?.guest ?? null}
          />
        ))}
      </svg>

      {/* The same information as a plain list. Whoever is laying out place
          cards reads down a list faster than around a circle, and it also
          survives being photocopied badly. */}
      <ol className="mt-2 text-sm columns-2 gap-6">
        {occupants.map(({ seatNumber, guest }) => (
          <li key={seatNumber} className="flex gap-2 break-inside-avoid py-0.5">
            <span className="w-5 text-dark/40 tabular-nums shrink-0">
              {seatNumber}
            </span>
            <span className={guest ? "text-dark" : "text-dark/35 italic"}>
              {guest ? `${guest.first_name} ${guest.last_name}` : "open"}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function SeatingPrint({
  objects,
  assignments,
  guests,
}: {
  objects: FloorObject[];
  assignments: SeatedGuest[];
  guests: AttendingGuest[];
}) {
  const guestById = new Map(guests.map((g) => [g.id, g]));

  const ordered = [...objects].sort(compareFloorObjects);

  const occupantBySeat = new Map<string, AttendingGuest>();
  /** Everyone at a table, including anyone parked there with no chair yet. */
  const assignmentsByObject = new Map<string, SeatedGuest[]>();
  for (const a of assignments) {
    const guest = guestById.get(a.guest_id);
    if (!guest) continue;
    const list = assignmentsByObject.get(a.object_id) ?? [];
    list.push(a);
    assignmentsByObject.set(a.object_id, list);
    if (a.seat_number !== null) {
      occupantBySeat.set(`${a.object_id}:${a.seat_number}`, guest);
    }
  }

  const assignmentByGuest = new Map(assignments.map((a) => [a.guest_id, a]));

  const placementFor = (guest: AttendingGuest) => {
    const assignment = assignmentByGuest.get(guest.id);
    const table = assignment
      ? (objects.find((o) => o.id === assignment.object_id) ?? null)
      : null;
    return { guest, table, seatNumber: assignment?.seat_number ?? null };
  };

  // Alphabetical index: the sheet for the welcome table, where people arrive
  // knowing their own name and nothing else.
  const index = guests.map(placementFor).sort((a, b) =>
    compareGuestsByLastName(a.guest, b.guest)
  );

  const unseated = index.filter((entry) => !entry.table);

  // The same guests grouped by table, surname-ordered within each. This is the
  // running order for writing place cards: you work one table at a time, and
  // within a table you want to find a name without reading all nine.
  const byTable = ordered.map((obj) => ({
    obj,
    guests: (assignmentsByObject.get(obj.id) ?? [])
      .map((a) => {
        const guest = guestById.get(a.guest_id);
        return guest ? { guest, seatNumber: a.seat_number } : null;
      })
      .filter((x): x is { guest: AttendingGuest; seatNumber: number | null } =>
        Boolean(x)
      )
      .sort((a, b) => compareGuestsByLastName(a.guest, b.guest)),
  }));

  return (
    <div className="print-root text-dark">
      <section className="print-page">
        <header className="text-center mb-4">
          <h1 className="font-heading text-4xl text-deep-sage">
            Seating Chart
          </h1>
          <p className="text-sm text-dark/55 mt-1">
            Andrew &amp; Kayla &middot; August 29, 2026 &middot; Belle Meade
            Mansion
          </p>
          {/* Built as one string rather than interleaved JSX expressions and
              text, which was dropping the space and printing "25tables". */}
          <p className="text-xs text-dark/40 mt-1">
            {`${guests.length} guests · ${ordered.length} tables · by table, then by last name`}
          </p>
        </header>

        <div className="text-sm columns-2 gap-8">
          {byTable.map(({ obj, guests: seated }) => (
            <div key={obj.id} className="break-inside-avoid mb-3">
              <h3 className="font-heading text-base text-deep-sage border-b border-sage/40 pb-0.5 mb-1">
                {obj.label}
                {obj.internal_name && (
                  <span className="text-xs text-dark/45 font-sans">
                    {" "}
                    &middot; {obj.internal_name}
                  </span>
                )}
              </h3>
              {seated.length === 0 ? (
                <p className="text-dark/35 italic">nobody seated yet</p>
              ) : (
                seated.map(({ guest, seatNumber }) => (
                  <p key={guest.id} className="flex justify-between gap-3">
                    <span className="truncate">
                      {guest.last_name}, {guest.first_name}
                    </span>
                    <span className="shrink-0 text-dark/45 tabular-nums">
                      {seatNumber ?? "-"}
                    </span>
                  </p>
                ))
              )}
            </div>
          ))}

          {unseated.length > 0 && (
            <div className="break-inside-avoid mb-3">
              <h3 className="font-heading text-base text-orange-800 border-b border-orange-300 pb-0.5 mb-1">
                Not seated ({unseated.length})
              </h3>
              {unseated.map(({ guest }) => (
                <p key={guest.id} className="truncate">
                  {guest.last_name}, {guest.first_name}
                </p>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Kept as a second sheet: this one answers "a guest just walked in and
          said their name", which the by-table page can't do without scanning
          all 25 blocks. */}
      <section className="print-page">
        <header className="text-center mb-4">
          <h1 className="font-heading text-3xl text-deep-sage">
            Every guest, A to Z
          </h1>
          <p className="text-xs text-dark/40 mt-1">
            Look up a name, find their table and seat
          </p>
        </header>

        <ol className="text-sm columns-2 gap-8">
          {index.map(({ guest, table, seatNumber }) => (
            <li
              key={guest.id}
              className="flex justify-between gap-3 break-inside-avoid py-[1px] border-b border-sage/20"
            >
              <span className="truncate">
                {guest.last_name}, {guest.first_name}
              </span>
              <span className="shrink-0 text-dark/60 tabular-nums">
                {table
                  ? `${table.label}${seatNumber ? ` · ${seatNumber}` : ""}`
                  : "not seated"}
              </span>
            </li>
          ))}
        </ol>
      </section>

      {ordered.map((obj) => {
        const occupants: SeatOccupant[] = Array.from(
          { length: obj.seat_count },
          (_, i) => ({
            seatNumber: i + 1,
            guest: occupantBySeat.get(`${obj.id}:${i + 1}`) ?? null,
          })
        );
        return (
          <TablePage
            key={obj.id}
            obj={obj}
            occupants={occupants}
            objects={objects}
          />
        );
      })}
    </div>
  );
}
