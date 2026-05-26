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
    image: "/images/graphics/timeline-2/Welcome & Ceremony.png",
  },
  {
    title: "Cocktail Hour",
    time: "6:15pm",
    description:
      "Guests are invited to enjoy drinks, light bites, and games",
    image: "/images/graphics/timeline-2/Cocktail Hour.png",
  },
  {
    title: "Dinner",
    time: "7:00pm",
    description: "Gather with us for a tented dinner and toasts",
    image: "/images/graphics/timeline-2/Dinner.png",
  },
  {
    title: "Dancing",
    time: "8:00pm",
    description:
      "Join us on the dance floor for live music and dessert",
    image: "/images/graphics/timeline-2/Dancing.png",
  },
  {
    title: "Farewell",
    time: "11:00pm",
    description:
      "The evening concludes with a joyful send-off. Thank you for celebrating with us!",
    image: "/images/graphics/timeline-2/Farewell.png",
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

  // Only show non-wedding events (game day, rehearsal dinner, etc.)
  // The wedding itself is covered by the hardcoded timeline below
  const otherEvents = events.filter(
    (e) => e.slug !== "wedding-ceremony-reception"
  );

  return (
    <div className="relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw] w-screen bg-sage/20 min-h-screen">
      <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
        {/* Page header */}
        <h1 className="text-4xl sm:text-5xl font-heading text-[#5C3D2E] mb-2 text-center">
          Schedule
        </h1>
        <p className="text-center text-[#5C3D2E]/60 mb-12">
          Here&apos;s what we have planned for the weekend.
        </p>

        {/* Friday Game Day - simple centered section */}
        {otherEvents.length > 0 && (
          <div className="text-center mb-16 max-w-3xl mx-auto">
            {otherEvents.map((event) => (
              <div key={event.id} className="mb-10">
                <div className="max-w-[200px] mx-auto mb-4">
                  <Image
                    src="/images/graphics/gameday.png"
                    alt="Game day illustration"
                    width={400}
                    height={200}
                    className="w-full h-auto mix-blend-multiply"
                  />
                </div>
                <h2 className="text-2xl font-heading text-[#5C3D2E] mb-2">
                  {event.name}
                </h2>
                {event.starts_at && (
                  <p className="text-sm text-[#5C3D2E]/60">
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
                {event.address && (
                  <p className="text-sm mt-1">
                    <a
                      href={mapsUrl(event.address)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#5C3D2E]/60 underline underline-offset-2 decoration-sage hover:text-[#5C3D2E] transition-colors"
                    >
                      {event.address}
                    </a>
                  </p>
                )}
                {event.description && (
                  <p className="text-sm text-[#5C3D2E]/50 mt-2">
                    {event.description}
                  </p>
                )}
              </div>
            ))}

            <div className="border-t border-[#5C3D2E]/10 mt-8" />
          </div>
        )}

        {/* Wedding Timeline */}
        <div className="text-center mb-10">
          <h2 className="text-3xl sm:text-4xl font-heading text-[#5C3D2E] mb-3">
            Wedding Timeline
          </h2>
          <p className="text-[#5C3D2E]/60 text-sm">
            All wedding day festivities will be hosted at Belle Meade Mansion
          </p>
          <p className="text-[#5C3D2E]/50 text-sm mt-1">
            <Link
              href="/what-to-wear"
              className="hover:text-[#5C3D2E] transition-colors"
            >
              Garden formal attire
            </Link>
          </p>
        </div>

        {/* Desktop: horizontal timeline */}
        <div className="hidden sm:block max-w-4xl mx-auto">
          {/* Illustrations row */}
          <div className="grid grid-cols-5 gap-6 mb-4">
            {TIMELINE_EVENTS.map((evt) => (
              <div
                key={evt.title}
                className="flex items-end justify-center"
              >
                <Image
                  src={evt.image}
                  alt={evt.title}
                  width={240}
                  height={160}
                  className="w-full h-auto max-h-[120px] object-contain mix-blend-multiply"
                />
              </div>
            ))}
          </div>

          {/* Titles row */}
          <div className="grid grid-cols-5 gap-6 mb-1">
            {TIMELINE_EVENTS.map((evt) => (
              <p
                key={evt.title}
                className="text-center font-heading text-[#5C3D2E] text-sm leading-tight"
              >
                {evt.title}
              </p>
            ))}
          </div>

          {/* Horizontal line with vertical ticks aligned to grid columns */}
          <div className="relative h-8">
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-[#5C3D2E]/30" />
            <div className="grid grid-cols-5 gap-6 h-full">
              {TIMELINE_EVENTS.map((_, i) => (
                <div key={i} className="flex justify-center">
                  <div className="w-[2px] h-4 bg-[#5C3D2E]/30" />
                </div>
              ))}
            </div>
          </div>

          {/* Times row */}
          <div className="grid grid-cols-5 gap-6 mb-3">
            {TIMELINE_EVENTS.map((evt) => (
              <p
                key={evt.title}
                className="text-center font-heading text-[#5C3D2E] text-lg"
              >
                {evt.time}
              </p>
            ))}
          </div>

          {/* Descriptions row */}
          <div className="grid grid-cols-5 gap-6">
            {TIMELINE_EVENTS.map((evt) => (
              <p
                key={evt.title}
                className="text-center text-[#5C3D2E]/60 text-xs leading-relaxed"
              >
                {evt.description}
              </p>
            ))}
          </div>
        </div>

        {/* Mobile: centered vertical timeline */}
        <div className="sm:hidden space-y-8 px-4">
          {TIMELINE_EVENTS.map((evt, i) => (
            <div key={evt.title} className="text-center">
              <Image
                src={evt.image}
                alt={evt.title}
                width={160}
                height={120}
                className="w-24 h-auto object-contain mix-blend-multiply mx-auto mb-2"
              />
              <h3 className="font-heading text-[#5C3D2E] text-base leading-snug">
                {evt.title}
              </h3>
              <p className="font-heading text-[#5C3D2E]/70 text-sm">
                {evt.time}
              </p>
              <p className="text-[#5C3D2E]/50 text-sm leading-relaxed mt-1 max-w-[280px] mx-auto">
                {evt.description}
              </p>
              {i < TIMELINE_EVENTS.length - 1 && (
                <div className="w-[1.5px] h-6 bg-[#5C3D2E]/20 mx-auto mt-4" />
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="mt-16 text-center">
          <p className="text-sm text-[#5C3D2E]/40">
            More details to come as the day gets closer.
          </p>
        </div>
      </div>
    </div>
  );
}
