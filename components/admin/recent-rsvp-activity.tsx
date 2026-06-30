"use client";

import { useState } from "react";

type RsvpEntry = {
  id: string;
  status: string;
  responded_at: string | null;
  guest: unknown;
  event: unknown;
};

const PAGE_SIZE = 10;

export function RecentRsvpActivity({ rsvps }: { rsvps: RsvpEntry[] }) {
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  if (rsvps.length === 0) {
    return <p className="text-dark/60 text-sm">No RSVPs yet.</p>;
  }

  const visible = rsvps.slice(0, visibleCount);
  const hasMore = visibleCount < rsvps.length;

  return (
    <div className="bg-white rounded-xl border border-sage/30 overflow-hidden">
      <ul className="divide-y divide-sage/20">
        {visible.map((rsvp) => {
          const guest = rsvp.guest as {
            first_name: string;
            last_name: string;
          } | null;
          const event = rsvp.event as { name: string } | null;

          const guestName = guest
            ? `${guest.first_name} ${guest.last_name}`
            : "Unknown guest";
          const eventName = event?.name ?? "Unknown event";
          const respondedAt = rsvp.responded_at
            ? new Date(rsvp.responded_at).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })
            : "";

          return (
            <li
              key={rsvp.id}
              className="px-6 py-4 flex items-center justify-between"
            >
              <div>
                <p className="text-sm font-medium text-dark">{guestName}</p>
                <p className="text-xs text-dark/60">{eventName}</p>
              </div>
              <div className="flex items-center gap-3">
                <StatusBadge status={rsvp.status} />
                <span className="text-xs text-dark/50">{respondedAt}</span>
              </div>
            </li>
          );
        })}
      </ul>

      {hasMore && (
        <div className="border-t border-sage/20 px-6 py-3 text-center">
          <button
            type="button"
            onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
            className="text-sm font-medium text-deep-sage hover:text-pink transition-colors"
          >
            Show more ({rsvps.length - visibleCount} remaining)
          </button>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles =
    status === "attending"
      ? "bg-green-100 text-green-800"
      : status === "declined"
        ? "bg-red-100 text-red-700"
        : "bg-sage/30 text-deep-sage";

  return (
    <span
      className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${styles}`}
    >
      {status}
    </span>
  );
}
