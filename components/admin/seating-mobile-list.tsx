"use client";

import { useMemo, useState } from "react";
import {
  guestMatches,
  searchPlacements,
  type AttendingGuest,
  type FloorObject,
  type SeatedGuest,
} from "@/lib/seating";

/**
 * The seating chart as a list, for phones and tablets.
 *
 * The floor plan is a drag-and-drop canvas, and that is a desktop interaction:
 * a 60ft tent squeezed into a 375px screen puts each seat marker at about four
 * pixels, and seating someone means dragging a name from a panel that has been
 * pushed below the fold onto a target you cannot see. Shrinking that UI does
 * not fix it.
 *
 * So mobile gets a different shape for the same data: tap a table, tap a
 * chair, tap a name. Nothing is dragged, every target is a full-width row, and
 * the plan stays available on its own tab for when you want to see the room.
 *
 * The writes are the same server actions the canvas uses, passed in as
 * callbacks, so both views stay optimistic and share one undo history.
 */
export function SeatingMobileList({
  objects,
  assignmentsByObject,
  occupantBySeat,
  guestById,
  guests,
  unseated,
  assignmentByGuest,
  onSeatGuest,
  onSeatParty,
  onUnassign,
  isPending,
}: {
  objects: FloorObject[];
  assignmentsByObject: Map<string, SeatedGuest[]>;
  occupantBySeat: Map<string, AttendingGuest>;
  guestById: Map<string, AttendingGuest>;
  guests: AttendingGuest[];
  unseated: AttendingGuest[];
  assignmentByGuest: Map<string, SeatedGuest>;
  onSeatGuest: (guestId: string, objectId: string, seatNumber: number) => void;
  onSeatParty: (partyId: string, obj: FloorObject) => void;
  onUnassign: (guestId: string) => void;
  isPending: boolean;
}) {
  const [search, setSearch] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  /** Which chair the guest picker is currently filling. */
  const [picker, setPicker] = useState<{
    objectId: string;
    seatNumber: number;
  } | null>(null);

  const objectById = useMemo(
    () => new Map(objects.map((o) => [o.id, o])),
    [objects]
  );

  const ordered = useMemo(
    () =>
      [...objects].sort(
        (a, b) => a.sort_order - b.sort_order || a.label.localeCompare(b.label)
      ),
    [objects]
  );

  const results = useMemo(
    () => searchPlacements(guests, assignmentByGuest, objectById, search),
    [guests, assignmentByGuest, objectById, search]
  );

  /** Open a table and scroll it into view, e.g. from a search result. */
  function revealTable(objectId: string) {
    setOpenId(objectId);
    setPicker(null);
    // Deferred so the row exists in the DOM after the expand renders.
    requestAnimationFrame(() => {
      document
        .getElementById(`mobile-table-${objectId}`)
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  return (
    <div className="space-y-3">
      {/* Search across everyone, seated or not. */}
      <div className="bg-white rounded-xl border border-sage/30 p-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          type="search"
          placeholder="Search everyone, seated or not..."
          className="w-full px-3 py-2.5 rounded-lg border border-sage/50 text-dark text-base placeholder:text-dark/40 focus:outline-none focus:ring-2 focus:ring-pink focus:border-pink"
        />

        {search.trim() && (
          <div className="mt-2 space-y-1">
            {results.length === 0 ? (
              <p className="text-sm text-dark/40 py-1">Nobody matches that.</p>
            ) : (
              results.slice(0, 40).map(({ guest, object, seatNumber }) => (
                <button
                  key={guest.id}
                  type="button"
                  onClick={() => object && revealTable(object.id)}
                  disabled={!object}
                  className="w-full flex items-center justify-between gap-2 px-2 py-2 rounded-lg text-left hover:bg-sage/10 disabled:hover:bg-transparent transition-colors"
                >
                  <span className="min-w-0">
                    <span className="block text-sm text-dark truncate">
                      {guest.first_name} {guest.last_name}
                    </span>
                    <span className="block text-xs text-dark/45 truncate">
                      {guest.party_name}
                    </span>
                  </span>
                  <span className="text-xs shrink-0 text-right">
                    {object ? (
                      <>
                        <span className="block text-deep-sage font-medium">
                          {object.label}
                        </span>
                        <span className="block text-dark/40">
                          {seatNumber ? `seat ${seatNumber}` : "chair TBD"}
                        </span>
                      </>
                    ) : (
                      <span className="text-orange-700">Not seated</span>
                    )}
                  </span>
                </button>
              ))
            )}
            {results.length > 40 && (
              <p className="text-xs text-dark/40 px-2">
                Showing 40 of {results.length}. Keep typing to narrow it down.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Tables */}
      <div className="space-y-2">
        {ordered.map((obj) => {
          const seated = assignmentsByObject.get(obj.id) ?? [];
          const isOpen = openId === obj.id;
          const full = seated.length >= obj.seat_count;

          return (
            <div
              key={obj.id}
              id={`mobile-table-${obj.id}`}
              className="bg-white rounded-xl border border-sage/30 overflow-hidden scroll-mt-4"
            >
              <button
                type="button"
                onClick={() => {
                  setOpenId(isOpen ? null : obj.id);
                  setPicker(null);
                }}
                aria-expanded={isOpen}
                className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-sage/5 transition-colors"
              >
                <svg
                  className={`w-4 h-4 shrink-0 text-dark/40 transition-transform ${
                    isOpen ? "rotate-90" : ""
                  }`}
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2.5}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M8.25 4.5l7.5 7.5-7.5 7.5"
                  />
                </svg>
                <span className="flex-1 min-w-0">
                  <span className="block text-dark font-medium truncate">
                    {obj.label}
                  </span>
                  {obj.internal_name && (
                    <span className="block text-xs text-deep-sage truncate">
                      {obj.internal_name}
                    </span>
                  )}
                </span>
                <span
                  className={`text-sm shrink-0 tabular-nums ${
                    full ? "text-deep-sage" : "text-dark/50"
                  }`}
                >
                  {seated.length}/{obj.seat_count}
                </span>
              </button>

              {isOpen && (
                <div className="px-3 pb-3 border-t border-sage/20">
                  {Array.from({ length: obj.seat_count }, (_, i) => i + 1).map(
                    (n) => {
                      const occupant = occupantBySeat.get(`${obj.id}:${n}`);
                      const isPicking =
                        picker?.objectId === obj.id && picker.seatNumber === n;

                      return (
                        <div key={n}>
                          <div className="flex items-center gap-2 py-2 border-b border-sage/10 last:border-b-0">
                            <span className="w-6 text-xs text-dark/40 shrink-0 tabular-nums">
                              {n}
                            </span>
                            {occupant ? (
                              <>
                                <span className="flex-1 min-w-0">
                                  <span className="block text-sm text-dark truncate">
                                    {occupant.first_name} {occupant.last_name}
                                  </span>
                                  <span className="block text-xs text-dark/40 truncate">
                                    {occupant.party_name}
                                  </span>
                                </span>
                                <button
                                  type="button"
                                  onClick={() => onUnassign(occupant.id)}
                                  disabled={isPending}
                                  aria-label={`Remove ${occupant.first_name} ${occupant.last_name} from seat ${n}`}
                                  className="shrink-0 w-10 h-10 flex items-center justify-center rounded-lg text-dark/30 hover:text-red-600 hover:bg-red-50 transition-colors"
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
                                      d="M6 18L18 6M6 6l12 12"
                                    />
                                  </svg>
                                </button>
                              </>
                            ) : (
                              <button
                                type="button"
                                onClick={() =>
                                  setPicker(
                                    isPicking
                                      ? null
                                      : { objectId: obj.id, seatNumber: n }
                                  )
                                }
                                disabled={isPending}
                                className={`flex-1 flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg text-sm transition-colors ${
                                  isPicking
                                    ? "bg-pink/20 text-dark"
                                    : "text-dark/35 hover:bg-sage/10"
                                }`}
                              >
                                <span>{isPicking ? "Pick someone" : "Empty"}</span>
                                <span className="text-deep-sage text-xs font-medium">
                                  {isPicking ? "Cancel" : "+ Add"}
                                </span>
                              </button>
                            )}
                          </div>

                          {isPicking && (
                            <SeatPicker
                              obj={obj}
                              seatNumber={n}
                              guests={guests}
                              unseated={unseated}
                              assignmentByGuest={assignmentByGuest}
                              objectById={objectById}
                              freeSeats={obj.seat_count - seated.length}
                              isPending={isPending}
                              onPick={(guestId) => {
                                onSeatGuest(guestId, obj.id, n);
                                setPicker(null);
                              }}
                              onPickParty={(partyId) => {
                                onSeatParty(partyId, obj);
                                setPicker(null);
                              }}
                            />
                          )}
                        </div>
                      );
                    }
                  )}

                  {/* People parked at the table without a chair number. */}
                  {seated.some((a) => a.seat_number === null) && (
                    <div className="mt-2 pt-2 border-t border-sage/20">
                      <p className="text-xs text-dark/50 mb-1">
                        At this table, chair TBD
                      </p>
                      {seated
                        .filter((a) => a.seat_number === null)
                        .map((a) => {
                          const guest = guestById.get(a.guest_id);
                          if (!guest) return null;
                          return (
                            <div
                              key={a.guest_id}
                              className="flex items-center gap-2 py-1.5"
                            >
                              <span className="flex-1 text-sm text-dark truncate">
                                {guest.first_name} {guest.last_name}
                              </span>
                              <button
                                type="button"
                                onClick={() => onUnassign(guest.id)}
                                disabled={isPending}
                                aria-label={`Remove ${guest.first_name} ${guest.last_name}`}
                                className="shrink-0 w-10 h-10 flex items-center justify-center rounded-lg text-dark/30 hover:text-red-600"
                              >
                                &times;
                              </button>
                            </div>
                          );
                        })}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Who still needs a chair. Informational: seating happens from a table
          above, because a seat has to be chosen for the person to go into. */}
      <div className="bg-white rounded-xl border border-sage/30 p-4">
        <h3 className="text-sm font-medium text-deep-sage mb-2">
          Not seated yet ({unseated.length})
        </h3>
        {unseated.length === 0 ? (
          <p className="text-sm text-dark/40">Everyone has a seat.</p>
        ) : (
          <div className="space-y-0.5">
            {unseated.map((g) => (
              <p key={g.id} className="text-sm text-dark">
                {g.first_name} {g.last_name}
                <span className="text-dark/40 text-xs"> &middot; {g.party_name}</span>
              </p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Guest picker for one specific chair.
 *
 * Offers unseated people first, but will also move someone who is already
 * sitting elsewhere, because "actually, put Dad at this table instead" is a
 * normal thing to want and the desktop panel could only ever offer the
 * unseated.
 */
function SeatPicker({
  obj,
  seatNumber,
  guests,
  unseated,
  assignmentByGuest,
  objectById,
  freeSeats,
  isPending,
  onPick,
  onPickParty,
}: {
  obj: FloorObject;
  seatNumber: number;
  guests: AttendingGuest[];
  unseated: AttendingGuest[];
  assignmentByGuest: Map<string, SeatedGuest>;
  objectById: Map<string, FloorObject>;
  freeSeats: number;
  isPending: boolean;
  onPick: (guestId: string) => void;
  onPickParty: (partyId: string) => void;
}) {
  const [query, setQuery] = useState("");

  const matchingUnseated = useMemo(
    () => unseated.filter((g) => guestMatches(g, query)),
    [unseated, query]
  );

  const parties = useMemo(() => {
    const map = new Map<string, { name: string; guests: AttendingGuest[] }>();
    for (const g of matchingUnseated) {
      const entry = map.get(g.party_id) ?? { name: g.party_name, guests: [] };
      entry.guests.push(g);
      map.set(g.party_id, entry);
    }
    return [...map.entries()].sort((a, b) => a[1].name.localeCompare(b[1].name));
  }, [matchingUnseated]);

  // Only offered once you've typed: an unfiltered list of everyone already
  // seated would bury the unseated list this picker is mainly for.
  const seatedElsewhere = useMemo(() => {
    if (!query.trim()) return [];
    return searchPlacements(guests, assignmentByGuest, objectById, query).filter(
      (p) => p.object !== null && p.object.id !== obj.id
    );
  }, [guests, assignmentByGuest, objectById, query, obj.id]);

  return (
    <div className="mb-2 rounded-lg border border-pink/50 bg-pink/5 p-2.5">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        type="search"
        autoFocus
        placeholder={`Who goes in seat ${seatNumber}?`}
        className="w-full px-3 py-2.5 mb-2 rounded-lg border border-sage/50 bg-white text-dark text-base placeholder:text-dark/40 focus:outline-none focus:ring-2 focus:ring-pink focus:border-pink"
      />

      <div className="max-h-72 overflow-y-auto space-y-2">
        {parties.length === 0 && seatedElsewhere.length === 0 && (
          <p className="text-sm text-dark/40 py-1">
            {unseated.length === 0
              ? "Everyone already has a seat."
              : "Nobody matches that."}
          </p>
        )}

        {parties.map(([partyId, party]) => {
          const fits = party.guests.length <= freeSeats;
          return (
            <div
              key={partyId}
              className="rounded-lg border border-sage/25 bg-white p-1.5"
            >
              <div className="flex items-center justify-between gap-2 px-1 pb-1">
                <span className="text-xs text-dark/55 font-medium truncate">
                  {party.name}
                </span>
                {party.guests.length > 1 && (
                  <button
                    type="button"
                    onClick={() => onPickParty(partyId)}
                    disabled={isPending || !fits}
                    className="text-xs text-deep-sage shrink-0 px-2 py-1 rounded hover:bg-sage/15 disabled:opacity-40 disabled:hover:bg-transparent transition-colors"
                  >
                    {fits
                      ? `Seat all ${party.guests.length}`
                      : `needs ${party.guests.length}`}
                  </button>
                )}
              </div>
              {party.guests.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => onPick(g.id)}
                  disabled={isPending}
                  className="w-full text-left px-2 py-2.5 rounded-lg text-sm text-dark hover:bg-pink/15 disabled:opacity-40 transition-colors"
                >
                  {g.first_name} {g.last_name}
                </button>
              ))}
            </div>
          );
        })}

        {seatedElsewhere.length > 0 && (
          <div className="rounded-lg border border-sage/25 bg-white p-1.5">
            <p className="text-xs text-dark/55 font-medium px-1 pb-1">
              Seated elsewhere &middot; tap to move here
            </p>
            {seatedElsewhere.slice(0, 15).map(({ guest, object, seatNumber: at }) => (
              <button
                key={guest.id}
                type="button"
                onClick={() => onPick(guest.id)}
                disabled={isPending}
                className="w-full flex items-center justify-between gap-2 px-2 py-2.5 rounded-lg text-left hover:bg-pink/15 disabled:opacity-40 transition-colors"
              >
                <span className="text-sm text-dark truncate">
                  {guest.first_name} {guest.last_name}
                </span>
                <span className="text-xs text-dark/45 shrink-0">
                  {object?.label}
                  {at ? ` · seat ${at}` : ""}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
