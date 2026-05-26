import { cookies } from "next/headers";
import { createServiceClient } from "@/lib/supabase/server";
import { ScheduleContent } from "@/components/schedule-content";

export default async function SchedulePage() {
  const supabase = createServiceClient();

  const cookieStore = await cookies();
  const partyId = cookieStore.get("rsvp_party_id")?.value;

  const { data: allEvents } = await supabase
    .from("events")
    .select("*")
    .order("sort_order", { ascending: true });

  let events = allEvents || [];

  if (partyId) {
    const { data: partyEvents } = await supabase
      .from("party_events")
      .select("event_id")
      .eq("party_id", partyId);

    const invitedEventIds = new Set(
      (partyEvents || []).map((pe) => pe.event_id)
    );

    events = events.filter(
      (e) => invitedEventIds.has(e.id) || e.slug !== "rehearsal-dinner"
    );
  } else {
    events = events.filter((e) => e.slug !== "rehearsal-dinner");
  }

  // Only show non-wedding events (game day, rehearsal dinner, etc.)
  // The wedding itself is covered by the hardcoded timeline below
  const otherEvents = events.filter(
    (e) => e.slug !== "wedding-ceremony-reception"
  );

  return <ScheduleContent otherEvents={otherEvents} />;
}
