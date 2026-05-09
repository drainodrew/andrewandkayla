"use client";

import { useState, useMemo } from "react";
import type { PartyRow } from "@/app/admin/(dashboard)/guests/page";

/**
 * Client component for the admin guests table.
 * Handles search, expandable rows, and CSV export.
 * All data is passed in from the server component parent.
 */
export function GuestsTable({ parties }: { parties: PartyRow[] }) {
  const [search, setSearch] = useState("");
  const [expandedParties, setExpandedParties] = useState<Set<string>>(
    new Set()
  );

  // Filter parties by search term (matches invite_name, guest names, email)
  const filtered = useMemo(() => {
    if (!search.trim()) return parties;

    const term = search.toLowerCase().trim();
    return parties.filter((p) => {
      if (p.invite_name.toLowerCase().includes(term)) return true;
      if (p.email?.toLowerCase().includes(term)) return true;
      return p.guests.some(
        (g) =>
          g.first_name.toLowerCase().includes(term) ||
          g.last_name.toLowerCase().includes(term)
      );
    });
  }, [parties, search]);

  function toggleExpand(partyId: string) {
    setExpandedParties((prev) => {
      const next = new Set(prev);
      if (next.has(partyId)) {
        next.delete(partyId);
      } else {
        next.add(partyId);
      }
      return next;
    });
  }

  /**
   * Generate and download a CSV of all parties and guests.
   * Each row is one guest, with party info repeated.
   */
  function exportCsv() {
    const headers = [
      "Party Name",
      "Party Size",
      "Guest First Name",
      "Guest Last Name",
      "Is Placeholder",
      "RSVP Summary",
      "Dietary Notes",
      "Party Email",
      "Party Phone",
      "Party Notes",
    ];

    const rows = parties.flatMap((p) =>
      p.guests.map((g) => [
        csvEscape(p.invite_name),
        String(p.party_size),
        csvEscape(g.first_name),
        csvEscape(g.last_name),
        g.is_placeholder ? "Yes" : "No",
        csvEscape(
          g.rsvps.map((r) => `${r.event_name}: ${r.status}`).join("; ") ||
            "No response"
        ),
        csvEscape(g.dietary_notes ?? ""),
        csvEscape(p.email ?? ""),
        csvEscape(p.phone ?? ""),
        csvEscape(p.notes ?? ""),
      ])
    );

    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `wedding-guests-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      {/* Search and export controls */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-4 py-2.5 rounded-lg border border-sage/50 bg-white text-dark placeholder:text-dark/40 focus:outline-none focus:ring-2 focus:ring-pink focus:border-pink transition-colors text-sm"
          />
        </div>
        <button
          type="button"
          onClick={exportCsv}
          className="px-5 py-2.5 rounded-lg bg-pink text-dark text-sm font-medium hover:bg-pink/80 focus:outline-none focus:ring-2 focus:ring-pink focus:ring-offset-2 focus:ring-offset-cream transition-colors shrink-0"
        >
          Export CSV
        </button>
      </div>

      {/* Results count */}
      <p className="text-sm text-dark/60 mb-4">
        Showing {filtered.length} of {parties.length} parties
      </p>

      {/* Table */}
      <div className="bg-white rounded-xl border border-sage/30 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-sage/30 bg-sage/10">
              <th className="text-left px-4 py-3 font-medium text-deep-sage w-8">
                {/* Expand toggle column */}
              </th>
              <th className="text-left px-4 py-3 font-medium text-deep-sage">
                Party Name
              </th>
              <th className="text-left px-4 py-3 font-medium text-deep-sage">
                Size
              </th>
              <th className="text-left px-4 py-3 font-medium text-deep-sage">
                RSVP Status
              </th>
              <th className="text-left px-4 py-3 font-medium text-deep-sage hidden lg:table-cell">
                Dietary Notes
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-sage/20">
            {filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-8 text-center text-dark/50"
                >
                  No parties match your search.
                </td>
              </tr>
            ) : (
              filtered.map((party) => {
                const isExpanded = expandedParties.has(party.id);
                const rsvpSummary = getPartyRsvpSummary(party);
                const dietarySummary = getPartyDietarySummary(party);

                return (
                  <PartyTableRow
                    key={party.id}
                    party={party}
                    isExpanded={isExpanded}
                    onToggle={() => toggleExpand(party.id)}
                    rsvpSummary={rsvpSummary}
                    dietarySummary={dietarySummary}
                  />
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PartyTableRow({
  party,
  isExpanded,
  onToggle,
  rsvpSummary,
  dietarySummary,
}: {
  party: PartyRow;
  isExpanded: boolean;
  onToggle: () => void;
  rsvpSummary: string;
  dietarySummary: string;
}) {
  return (
    <>
      <tr
        className="hover:bg-sage/5 cursor-pointer transition-colors"
        onClick={onToggle}
      >
        <td className="px-4 py-3">
          <svg
            className={`w-4 h-4 text-dark/40 transition-transform ${
              isExpanded ? "rotate-90" : ""
            }`}
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M8.25 4.5l7.5 7.5-7.5 7.5"
            />
          </svg>
        </td>
        <td className="px-4 py-3 font-medium text-dark">
          {party.invite_name}
        </td>
        <td className="px-4 py-3 text-dark/70">{party.party_size}</td>
        <td className="px-4 py-3 text-dark/70">{rsvpSummary}</td>
        <td className="px-4 py-3 text-dark/70 hidden lg:table-cell">
          {dietarySummary || "None"}
        </td>
      </tr>

      {isExpanded && (
        <tr>
          <td colSpan={5} className="bg-cream/50 px-4 py-4">
            <div className="ml-8 space-y-3">
              {/* Party contact info */}
              {(party.email || party.phone) && (
                <div className="text-xs text-dark/60 space-x-4">
                  {party.email && <span>Email: {party.email}</span>}
                  {party.phone && <span>Phone: {party.phone}</span>}
                </div>
              )}
              {party.notes && (
                <div className="text-xs text-dark/50 italic">
                  Notes: {party.notes}
                </div>
              )}

              {/* Individual guest details */}
              <div className="space-y-2">
                {party.guests.map((guest) => (
                  <div
                    key={guest.id}
                    className="bg-white rounded-lg border border-sage/20 px-4 py-3"
                  >
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="font-medium text-sm text-dark">
                        {guest.first_name} {guest.last_name}
                      </span>
                      {guest.is_placeholder && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-sage/20 text-deep-sage">
                          placeholder
                        </span>
                      )}
                    </div>

                    {guest.rsvps.length > 0 ? (
                      <div className="flex flex-wrap gap-2 mt-1">
                        {guest.rsvps.map((rsvp, i) => (
                          <span
                            key={i}
                            className={`text-xs px-2 py-0.5 rounded-full ${
                              rsvp.status === "attending"
                                ? "bg-green-100 text-green-800"
                                : rsvp.status === "declined"
                                  ? "bg-red-100 text-red-700"
                                  : "bg-sage/20 text-deep-sage"
                            }`}
                          >
                            {rsvp.event_name}: {rsvp.status}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-dark/40 mt-1">
                        No RSVP response yet
                      </p>
                    )}

                    {guest.dietary_notes && (
                      <p className="text-xs text-dark/60 mt-1">
                        Dietary: {guest.dietary_notes}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

/**
 * Summarize a party's RSVP status for the table row.
 * e.g. "2 attending, 1 declined" or "No response"
 */
function getPartyRsvpSummary(party: PartyRow): string {
  let attending = 0;
  let declined = 0;
  let pending = 0;
  let hasAnyRsvp = false;

  for (const guest of party.guests) {
    if (guest.rsvps.length > 0) {
      hasAnyRsvp = true;
      for (const r of guest.rsvps) {
        if (r.status === "attending") attending++;
        else if (r.status === "declined") declined++;
        else pending++;
      }
    }
  }

  if (!hasAnyRsvp) return "No response";

  const parts: string[] = [];
  if (attending > 0) parts.push(`${attending} attending`);
  if (declined > 0) parts.push(`${declined} declined`);
  if (pending > 0) parts.push(`${pending} pending`);
  return parts.join(", ");
}

/**
 * Collect all dietary notes across guests in a party.
 */
function getPartyDietarySummary(party: PartyRow): string {
  return party.guests
    .filter((g) => g.dietary_notes)
    .map((g) => `${g.first_name}: ${g.dietary_notes}`)
    .join("; ");
}

/**
 * Escape a string for CSV output.
 * Wraps in quotes if the value contains commas, quotes, or newlines.
 */
function csvEscape(value: string): string {
  if (
    value.includes(",") ||
    value.includes('"') ||
    value.includes("\n")
  ) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
