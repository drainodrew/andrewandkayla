"use client";

import Image from "next/image";
import Link from "next/link";
import { useLanguage, getTranslations } from "@/lib/i18n";

function mapsUrl(address: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

const TIMELINE_IMAGES = [
  "/images/graphics/timeline-2/Welcome & Ceremony.png",
  "/images/graphics/timeline-2/Cocktail Hour.png",
  "/images/graphics/timeline-2/Dinner.png",
  "/images/graphics/timeline-2/Dancing.png",
  "/images/graphics/timeline-2/Farewell.png",
];

interface EventData {
  id: string;
  slug: string;
  name: string;
  starts_at: string | null;
  ends_at: string | null;
  address: string | null;
  description: string | null;
}

export function ScheduleContent({ otherEvents }: { otherEvents: EventData[] }) {
  const { lang } = useLanguage();
  const t = getTranslations(lang);

  const timelineEvents = t.schedule.events.map((evt, i) => ({
    ...evt,
    image: TIMELINE_IMAGES[i],
  }));

  return (
    <div className="relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw] w-screen bg-sage/20 min-h-screen">
      <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
        {/* Page header */}
        <h1 className="text-4xl sm:text-5xl font-heading text-[#5C3D2E] mb-2 text-center">
          {t.schedule.title}
        </h1>
        <p className="text-center text-[#5C3D2E]/60 mb-12">
          {t.schedule.subtitle}
        </p>

        {/* Other events (game day, rehearsal dinner) */}
        {otherEvents.length > 0 && (
          <div className="text-center mb-16 max-w-3xl mx-auto">
            {otherEvents.map((event) => (
              <div key={event.id} className="mb-10">
                {event.slug === "rehearsal-dinner" ? (
                  <div className="max-w-[160px] mx-auto mb-4">
                    <Image
                      src="/images/graphics/rehearsal-dinner.jpg"
                      alt="Couple holding a heart"
                      width={400}
                      height={500}
                      className="w-full h-auto mix-blend-multiply"
                    />
                  </div>
                ) : (
                  <div className="max-w-[160px] mx-auto mb-4">
                    <Image
                      src="/images/graphics/tennis-gameday.jpeg"
                      alt="Andrew and Kayla with tennis rackets"
                      width={400}
                      height={500}
                      className="w-full h-auto mix-blend-multiply"
                    />
                  </div>
                )}
                <h2 className="text-2xl font-heading text-[#5C3D2E] mb-2">
                  {event.name}
                </h2>
                {event.starts_at && (
                  <p className="text-sm text-[#5C3D2E]/60">
                    {new Date(event.starts_at).toLocaleDateString(lang === "es" ? "es-US" : "en-US", {
                      weekday: "long",
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                    })}
                    {event.ends_at && (
                      <>
                        {" "}
                        &middot;{" "}
                        {new Date(event.starts_at).toLocaleTimeString(lang === "es" ? "es-US" : "en-US", {
                          hour: "numeric",
                          minute: "2-digit",
                        })}{" "}
                        {lang === "es" ? "a" : "to"}{" "}
                        {new Date(event.ends_at).toLocaleTimeString(lang === "es" ? "es-US" : "en-US", {
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
            {t.schedule.timelineTitle}
          </h2>
          <p className="text-[#5C3D2E]/60 text-sm">
            {t.schedule.timelineSubtitle}
          </p>
          <p className="text-[#5C3D2E]/50 text-sm mt-1">
            <Link
              href="/what-to-wear"
              className="hover:text-[#5C3D2E] transition-colors"
            >
              {t.schedule.gardenFormal}
            </Link>
          </p>
        </div>

        {/* Desktop: horizontal timeline */}
        <div className="hidden sm:block max-w-4xl mx-auto">
          {/* Illustrations row */}
          <div className="grid grid-cols-5 gap-6 mb-4">
            {timelineEvents.map((evt) => (
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
            {timelineEvents.map((evt) => (
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
              {timelineEvents.map((_, i) => (
                <div key={i} className="flex justify-center">
                  <div className="w-[2px] h-4 bg-[#5C3D2E]/30" />
                </div>
              ))}
            </div>
          </div>

          {/* Times row */}
          <div className="grid grid-cols-5 gap-6 mb-3">
            {timelineEvents.map((evt) => (
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
            {timelineEvents.map((evt) => (
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
          {timelineEvents.map((evt, i) => (
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
              {i < timelineEvents.length - 1 && (
                <div className="w-[1.5px] h-6 bg-[#5C3D2E]/20 mx-auto mt-4" />
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="mt-16 text-center">
          <p className="text-sm text-[#5C3D2E]/40">
            {t.schedule.footer}
          </p>
        </div>
      </div>
    </div>
  );
}
