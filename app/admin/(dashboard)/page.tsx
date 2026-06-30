import Link from "next/link";
import { createServiceClient } from "@/lib/supabase/server";
import { RecentRsvpActivity } from "@/components/admin/recent-rsvp-activity";

/**
 * Admin dashboard: summary cards and recent RSVP activity.
 * All data is fetched server-side with the service role client.
 */
export default async function AdminDashboardPage() {
  const supabase = createServiceClient();

  // Fetch all summary data in parallel
  const [
    partiesResult,
    guestsResult,
    attendingResult,
    declinedResult,
    allRsvpsResult,
    recentRsvpsResult,
    eventsResult,
    perEventRsvpsResult,
  ] = await Promise.all([
    supabase.from("parties").select("id", { count: "exact", head: true }),
    supabase.from("guests").select("id", { count: "exact", head: true }),
    // Fetch guest_id for attending/declined to count unique people
    supabase
      .from("rsvps")
      .select("guest_id")
      .eq("status", "attending"),
    supabase
      .from("rsvps")
      .select("guest_id")
      .eq("status", "declined"),
    supabase.from("rsvps").select("id", { count: "exact", head: true }),
    // Recent RSVPs: join with guest and event info for the activity feed.
    // Fetch all responses so the client component can paginate with "Show more".
    supabase
      .from("rsvps")
      .select(
        "id, status, responded_at, guest:guests(first_name, last_name), event:events(name)"
      )
      .not("responded_at", "is", null)
      .order("responded_at", { ascending: false }),
    // All events for per-event breakdown
    supabase.from("events").select("id, name, slug").order("sort_order"),
    // All RSVPs with event_id and status for per-event counts
    supabase.from("rsvps").select("event_id, status").not("responded_at", "is", null),
  ]);

  const totalParties = partiesResult.count ?? 0;
  const totalGuests = guestsResult.count ?? 0;
  // Count unique guests, not RSVP rows (a guest RSVPs to multiple events)
  const attendingCount = new Set((attendingResult.data ?? []).map((r) => r.guest_id)).size;
  const declinedCount = new Set((declinedResult.data ?? []).map((r) => r.guest_id)).size;
  const totalRsvps = allRsvpsResult.count ?? 0;

  // "Pending" = total guests minus those who have any RSVP response.
  // This is a simplification; a more precise count would check per-event.
  // For the dashboard summary, this gives Andrew and Kayla a quick sense
  // of how many people have responded at all.
  const pendingCount = totalGuests - new Set(
    // We don't have individual guest response data here, so use a simpler metric:
    // total guests minus the unique guests who have at least one RSVP
    // For the summary card, we'll show total RSVP records instead
  ).size;

  // Actually, let's compute unique guests who responded
  const { data: respondedGuests } = await supabase
    .from("rsvps")
    .select("guest_id")
    .not("responded_at", "is", null);

  const uniqueRespondedGuests = new Set(
    (respondedGuests ?? []).map((r) => r.guest_id)
  ).size;
  const noResponseCount = totalGuests - uniqueRespondedGuests;

  const recentRsvps = recentRsvpsResult.data ?? [];

  // Per-event RSVP breakdown
  const events = eventsResult.data ?? [];
  const perEventRsvps = perEventRsvpsResult.data ?? [];
  const eventBreakdown = events.map((event) => {
    const eventRsvps = perEventRsvps.filter((r) => r.event_id === event.id);
    return {
      name: event.name,
      slug: event.slug,
      attending: eventRsvps.filter((r) => r.status === "attending").length,
      declined: eventRsvps.filter((r) => r.status === "declined").length,
    };
  });

  return (
    <div className="max-w-5xl">
      <h1 className="font-heading text-3xl text-deep-sage mb-8">Dashboard</h1>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        <SummaryCard label="Total Parties" value={totalParties} />
        <SummaryCard label="Total Guests" value={totalGuests} />
        <SummaryCard
          label="Attending"
          value={attendingCount}
          accent="green"
        />
        <SummaryCard label="Declined" value={declinedCount} accent="red" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-10">
        <SummaryCard label="No Response Yet" value={noResponseCount} />
        <SummaryCard label="Total RSVPs" value={totalRsvps} subtitle="(individual guest + event responses)" />
      </div>

      {/* Per-event breakdown */}
      <h2 className="font-heading text-xl text-deep-sage mb-4">
        RSVPs by Event
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-10">
        {eventBreakdown.map((evt) => (
          <Link
            key={evt.name}
            href={`/admin/events/${evt.slug}`}
            className="bg-white rounded-xl border border-sage/30 p-6 transition-colors hover:border-pink hover:bg-pink/5"
          >
            <p className="text-sm font-medium text-dark mb-3">{evt.name}</p>
            <div className="flex items-baseline gap-6">
              <div>
                <p className="text-2xl font-heading text-green-700">{evt.attending}</p>
                <p className="text-xs text-dark/50">attending</p>
              </div>
              <div>
                <p className="text-2xl font-heading text-red-600">{evt.declined}</p>
                <p className="text-xs text-dark/50">declined</p>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Recent activity */}
      <h2 className="font-heading text-xl text-deep-sage mb-4">
        Recent RSVP Activity
      </h2>

      <RecentRsvpActivity rsvps={recentRsvps} />
    </div>
  );
}

function SummaryCard({
  label,
  value,
  subtitle,
  accent,
}: {
  label: string;
  value: number;
  subtitle?: string;
  accent?: "green" | "red";
}) {
  const accentColor =
    accent === "green"
      ? "text-green-700"
      : accent === "red"
        ? "text-red-600"
        : "text-dark";

  return (
    <div className="bg-white rounded-xl border border-sage/30 p-6">
      <p className="text-sm text-dark/60 mb-1">{label}</p>
      <p className={`text-3xl font-heading ${accentColor}`}>{value}</p>
      {subtitle && (
        <p className="text-xs text-dark/40 mt-1">{subtitle}</p>
      )}
    </div>
  );
}

