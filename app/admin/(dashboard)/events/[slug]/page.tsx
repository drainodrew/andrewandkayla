import Link from "next/link";
import { createServiceClient } from "@/lib/supabase/server";

/**
 * Admin event detail page: shows all guests who RSVPed to a specific event,
 * grouped by status (attending, declined). Accessed via the event slug.
 */
export default async function AdminEventPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = createServiceClient();

  // Look up the event by slug
  const { data: event } = await supabase
    .from("events")
    .select("id, name, slug")
    .eq("slug", slug)
    .single();

  if (!event) {
    return (
      <div className="max-w-3xl">
        <Link
          href="/admin"
          className="inline-block mb-6 text-sm font-medium text-pink hover:underline"
        >
          &larr; Back to Dashboard
        </Link>
        <h1 className="font-heading text-3xl text-deep-sage mb-4">
          Event Not Found
        </h1>
        <p className="text-dark/60 text-sm">
          No event matching &ldquo;{slug}&rdquo; was found.
        </p>
      </div>
    );
  }

  // Fetch all RSVPs for this event, joined with guest and party info.
  // Only include RSVPs that have been responded to (not pending/unsubmitted).
  const { data: rsvps } = await supabase
    .from("rsvps")
    .select(
      "id, status, responded_at, guest:guests(id, first_name, last_name, party_id, party:parties(id, invite_name))"
    )
    .eq("event_id", event.id)
    .not("responded_at", "is", null)
    .order("responded_at", { ascending: false });

  type RsvpRow = {
    id: string;
    status: string;
    responded_at: string | null;
    guest: {
      id: string;
      first_name: string;
      last_name: string;
      party_id: string;
      party: {
        id: string;
        invite_name: string;
      } | null;
    } | null;
  };

  const typedRsvps = (rsvps ?? []) as unknown as RsvpRow[];

  const attending = typedRsvps.filter((r) => r.status === "attending");
  const declined = typedRsvps.filter((r) => r.status === "declined");

  return (
    <div className="max-w-3xl">
      <Link
        href="/admin"
        className="inline-block mb-6 text-sm font-medium text-pink hover:underline"
      >
        &larr; Back to Dashboard
      </Link>

      <h1 className="font-heading text-3xl text-deep-sage mb-8">
        {event.name}
      </h1>

      {/* Attending section */}
      <RsvpSection
        title="Attending"
        count={attending.length}
        rsvps={attending}
        accent="green"
      />

      {/* Declined section */}
      <RsvpSection
        title="Declined"
        count={declined.length}
        rsvps={declined}
        accent="red"
      />
    </div>
  );
}

type RsvpEntry = {
  id: string;
  status: string;
  responded_at: string | null;
  guest: {
    id: string;
    first_name: string;
    last_name: string;
    party_id: string;
    party: {
      id: string;
      invite_name: string;
    } | null;
  } | null;
};

function RsvpSection({
  title,
  count,
  rsvps,
  accent,
}: {
  title: string;
  count: number;
  rsvps: RsvpEntry[];
  accent: "green" | "red";
}) {
  const badgeStyles =
    accent === "green"
      ? "bg-green-100 text-green-800"
      : "bg-red-100 text-red-700";

  const countColor =
    accent === "green" ? "text-green-700" : "text-red-600";

  return (
    <section className="mb-8">
      <div className="flex items-center gap-3 mb-4">
        <h2 className="font-heading text-xl text-deep-sage">{title}</h2>
        <span className={`text-sm font-medium ${countColor}`}>
          ({count})
        </span>
      </div>

      {rsvps.length === 0 ? (
        <p className="text-dark/60 text-sm">None yet.</p>
      ) : (
        <div className="bg-white rounded-xl border border-sage/30 overflow-hidden">
          <ul className="divide-y divide-sage/20">
            {rsvps.map((rsvp) => {
              const guestName = rsvp.guest
                ? `${rsvp.guest.first_name} ${rsvp.guest.last_name}`
                : "Unknown guest";
              const partyName = rsvp.guest?.party?.invite_name ?? null;

              return (
                <li
                  key={rsvp.id}
                  className="px-6 py-4 flex items-center justify-between"
                >
                  <div>
                    <p className="text-sm font-medium text-dark">
                      {guestName}
                    </p>
                    {partyName && (
                      <p className="text-xs text-dark/50">{partyName}</p>
                    )}
                  </div>
                  <span
                    className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${badgeStyles}`}
                  >
                    {rsvp.status}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}
