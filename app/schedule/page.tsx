import { cookies } from "next/headers";
import Link from "next/link";
import { createServiceClient } from "@/lib/supabase/server";

function mapsUrl(address: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

export default async function SchedulePage() {
  const supabase = createServiceClient();

  // Read the RSVP cookie to identify the current party
  const cookieStore = await cookies();
  const partyId = cookieStore.get("rsvp_party_id")?.value;

  // Fetch all events
  const { data: allEvents } = await supabase
    .from("events")
    .select("*")
    .order("sort_order", { ascending: true });

  let events = allEvents || [];

  // If we know who the guest is, filter out events they're not invited to.
  // The rehearsal dinner is invite-only (requires a party_events row).
  // If no cookie, show only non-restricted events (game day + wedding).
  if (partyId) {
    // Fetch which events this party is explicitly invited to
    const { data: partyEvents } = await supabase
      .from("party_events")
      .select("event_id")
      .eq("party_id", partyId);

    const invitedEventIds = new Set(
      (partyEvents || []).map((pe) => pe.event_id)
    );

    // Show an event if:
    // 1. The party has a party_events row for it, OR
    // 2. The event is NOT the rehearsal dinner (universal events)
    events = events.filter(
      (e) => invitedEventIds.has(e.id) || e.slug !== "rehearsal-dinner"
    );
  } else {
    // No cookie: hide the rehearsal dinner entirely
    events = events.filter((e) => e.slug !== "rehearsal-dinner");
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="text-4xl font-heading text-deep-sage mb-2 text-center">
        Schedule
      </h1>
      <p className="text-center text-dark/60 mb-12">
        Here&apos;s what we have planned. More details to come as the day gets
        closer.
      </p>

      {events.length === 0 ? (
        <p className="text-center text-dark/60">
          Events will be posted here soon. Check back!
        </p>
      ) : (
        <div className="space-y-6">
          {events.map((event) => (
            <div
              key={event.id}
              className="rounded-xl border border-sage/30 bg-sage/20 p-6"
            >
              <h2 className="text-xl font-heading text-deep-sage mb-2">
                {event.name}
              </h2>

              <div className="space-y-1 mb-4">
                {event.starts_at && (
                  <p className="text-sm text-[#5C3D2E]">
                    {new Date(event.starts_at).toLocaleDateString("en-US", {
                      weekday: "long",
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                    })}
                    {event.ends_at && (
                      <>
                        {" "}
                        &middot;{" "}
                        {new Date(event.starts_at).toLocaleTimeString("en-US", {
                          hour: "numeric",
                          minute: "2-digit",
                        })}{" "}
                        to{" "}
                        {new Date(event.ends_at).toLocaleTimeString("en-US", {
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </>
                    )}
                  </p>
                )}

                {event.location && (
                  <p className="text-sm text-[#5C3D2E]">{event.location}</p>
                )}

                {event.address && (
                  <p className="text-sm">
                    <a
                      href={mapsUrl(event.address)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#5C3D2E] underline underline-offset-2 decoration-sage hover:text-deep-sage transition-colors"
                    >
                      {event.address}
                    </a>
                  </p>
                )}

                {event.dress_code && (
                  <p className="text-sm text-[#5C3D2E] mt-3">
                    Dress code:{" "}
                    <Link href="/what-to-wear" className="text-[#5C3D2E] underline underline-offset-2 decoration-sage hover:text-deep-sage transition-colors">
                      {event.dress_code}
                    </Link>
                  </p>
                )}
              </div>

              {event.description && (
                <p className="text-[#5C3D2E]">{event.description}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
