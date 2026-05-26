import { cookies } from "next/headers";
import Image from "next/image";
import Link from "next/link";
import { createServiceClient } from "@/lib/supabase/server";

function mapsUrl(address: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

const TIMELINE_EVENTS = [
  {
    title: "Welcome & Ceremony",
    time: "5:15pm",
    description:
      "Please arrive at 5:15pm to enjoy light grazing and welcome drinks as we gather for the ceremony",
    image: "/images/graphics/timeline-ceremony.png",
  },
  {
    title: "Cocktail Hour",
    time: "6:15pm",
    description:
      "Guests are invited to enjoy drinks, light bites, and games",
    image: "/images/graphics/timeline-cocktails.png",
  },
  {
    title: "Dinner",
    time: "7:00pm",
    description: "Gather with us for a tented dinner and toasts",
    image: "/images/graphics/timeline-dinner.png",
  },
  {
    title: "Continued Celebration",
    time: "8:00pm",
    description:
      "Join us on the dance floor for live music and dessert",
    image: "/images/graphics/timeline-dancing.png",
  },
  {
    title: "Farewell",
    time: "11:00pm",
    description:
      "The evening concludes with a joyful send-off. Thank you for celebrating with us!",
    image: "/images/graphics/timeline-farewell.png",
  },
];

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

  // Separate wedding from other events
  const weddingEvent = events.find((e) => e.slug === "wedding-day");
  const otherEvents = events.filter((e) => e.slug !== "wedding-day");

  return (
    <div className="relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw] w-screen bg-sage/20 min-h-screen">
      <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
        {/* Page header */}
        <h1 className="text-4xl sm:text-5xl font-heading text-pink mb-2 text-center">
          Schedule
        </h1>
        <p className="text-center text-[#5C3D2E]/60 mb-12">
          Here&apos;s what we have planned for the weekend.
        </p>

        {/* Other events (game day, rehearsal dinner) */}
        {otherEvents.length > 0 && (
          <div className="space-y-6 mb-16 max-w-3xl mx-auto">
            {otherEvents.map((event) => (
              <div
                key={event.id}
                className="rounded-xl border border-sage/30 bg-cream p-6"
              >
                <h2 className="text-xl font-heading text-pink mb-2">
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
                          {new Date(event.starts_at).toLocaleTimeString(
                            "en-US",
                            { hour: "numeric", minute: "2-digit" }
                          )}{" "}
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
                      <Link
                        href="/what-to-wear"
                        className="text-[#5C3D2E] underline underline-offset-2 decoration-sage hover:text-deep-sage transition-colors"
                      >
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

        {/* Wedding Timeline */}
        <div className="text-center mb-8">
          <h2 className="text-3xl sm:text-4xl font-heading text-pink mb-2">
            Wedding Timeline
          </h2>
          <p className="text-[#5C3D2E]/60 text-sm">
            All wedding day festivities will be hosted at Belle Meade Mansion
          </p>
          <p className="text-[#5C3D2E]/50 text-sm mt-1">
            <Link
              href="/what-to-wear"
              className="hover:text-pink transition-colors"
            >
              Garden formal attire
            </Link>
          </p>
          {weddingEvent?.address && (
            <p className="text-sm mt-1">
              <a
                href={mapsUrl(weddingEvent.address)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#5C3D2E]/50 underline underline-offset-2 decoration-sage/50 hover:text-deep-sage transition-colors"
              >
                {weddingEvent.address}
              </a>
            </p>
          )}
        </div>

        {/* Desktop: horizontal timeline */}
        <div className="hidden sm:block">
          {/* Illustrations row */}
          <div className="grid grid-cols-5 gap-4 mb-2">
            {TIMELINE_EVENTS.map((evt) => (
              <div key={evt.title} className="flex items-end justify-center h-28">
                <Image
                  src={evt.image}
                  alt={evt.title}
                  width={200}
                  height={160}
                  className="h-full w-auto object-contain mix-blend-multiply"
                />
              </div>
            ))}
          </div>

          {/* Timeline bar with titles */}
          <div className="relative grid grid-cols-5 gap-4">
            {/* Horizontal line */}
            <div className="absolute top-[2.2rem] left-[10%] right-[10%] h-[2px] bg-pink/40" />

            {TIMELINE_EVENTS.map((evt) => (
              <div key={evt.title} className="text-center relative">
                <p className="font-heading text-pink text-sm mb-2">
                  {evt.title}
                </p>
                {/* Vertical tick */}
                <div className="mx-auto w-[2px] h-4 bg-pink/40" />
                <p className="font-heading text-[#5C3D2E] text-lg mt-2">
                  {evt.time}
                </p>
                <p className="text-[#5C3D2E]/60 text-xs mt-2 leading-relaxed px-2">
                  {evt.description}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Mobile: vertical timeline */}
        <div className="sm:hidden space-y-8">
          {TIMELINE_EVENTS.map((evt, i) => (
            <div key={evt.title} className="flex gap-4 items-start">
              {/* Left: vertical timeline line + dot */}
              <div className="flex flex-col items-center shrink-0 w-8">
                <div className="w-3 h-3 rounded-full bg-pink border-2 border-pink/60 mt-1" />
                {i < TIMELINE_EVENTS.length - 1 && (
                  <div className="w-[2px] flex-1 bg-pink/30 mt-1" />
                )}
              </div>

              {/* Right: content */}
              <div className="flex-1 pb-2">
                <div className="flex items-start gap-3 mb-2">
                  <div className="flex-1">
                    <h3 className="font-heading text-pink text-lg leading-snug">
                      {evt.title}
                    </h3>
                    <p className="font-heading text-[#5C3D2E] text-base">
                      {evt.time}
                    </p>
                  </div>
                  <Image
                    src={evt.image}
                    alt={evt.title}
                    width={100}
                    height={80}
                    className="w-16 h-auto object-contain mix-blend-multiply shrink-0"
                  />
                </div>
                <p className="text-[#5C3D2E]/60 text-sm leading-relaxed">
                  {evt.description}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Footer note */}
        <div className="mt-16 text-center">
          <p className="text-sm text-[#5C3D2E]/40">
            More details to come as the day gets closer.
          </p>
        </div>
      </div>
    </div>
  );
}
