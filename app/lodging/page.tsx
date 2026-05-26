"use client";

import { useLanguage, getTranslations } from "@/lib/i18n";

function mapsUrl(query: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query + ", Nashville, TN")}`;
}

export default function LodgingPage() {
  const { lang } = useLanguage();
  const t = getTranslations(lang);
  const sections = t.lodging.sections;

  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="text-4xl font-heading text-deep-sage mb-2 text-center">
        {t.lodging.title}
      </h1>
      <p className="text-center text-dark/60 mb-12">
        {t.lodging.subtitle}
      </p>

      {/* Getting There */}
      <section className="mb-12">
        <h2 className="text-2xl font-heading text-deep-sage mb-4">
          {t.lodging.gettingThere}
        </h2>
        <div className="rounded-xl border border-sage/30 bg-sage/20 p-6 space-y-4">
          <div>
            <h3 className="font-medium text-dark mb-1">{t.lodging.byAir}</h3>
            <p className="text-sm text-dark/70">
              {t.lodging.byAirDesc}
            </p>
          </div>
          <div>
            <h3 className="font-medium text-dark mb-1">{t.lodging.byCar}</h3>
            <p className="text-sm text-dark/70">
              {t.lodging.byCarDesc}{" "}
              <a
                href="https://www.google.com/maps/search/?api=1&query=110+Leake+Ave%2C+Nashville%2C+TN+37205"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#5C3D2E] underline underline-offset-2 decoration-sage hover:text-deep-sage transition-colors"
              >
                110 Leake Ave, Nashville, TN 37205
              </a>
              {t.lodging.byCarDesc2}
            </p>
          </div>
          <div>
            <h3 className="font-medium text-dark mb-1">{t.lodging.gettingAround}</h3>
            <p className="text-sm text-dark/70">
              {t.lodging.gettingAroundDesc}
            </p>
          </div>
        </div>
      </section>

      {/* Where to Stay */}
      <section className="mb-12">
        <h2 className="text-2xl font-heading text-deep-sage mb-2">
          {t.lodging.whereToStay}
        </h2>
        <p className="text-sm text-dark/60 mb-8">
          {t.lodging.whereToStayDesc}
        </p>

        <div className="space-y-10">
          {sections.map((section) => (
            <div key={section.title}>
              <h3 className="text-xl font-heading text-deep-sage mb-1">
                {section.title}
              </h3>
              <p className="text-sm text-dark/50 mb-4">
                {section.description}
              </p>
              {section.hotels.length > 0 ? (
                <div className="space-y-3">
                  {section.hotels.map((hotel) => (
                    <div
                      key={hotel.name}
                      className="rounded-xl border border-sage/30 bg-sage/20 p-5"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <a
                          href={mapsUrl(hotel.name)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium text-dark hover:text-pink transition-colors"
                        >
                          {hotel.name}
                        </a>
                        <span className="shrink-0 text-xs text-dark/50">
                          {hotel.proximity}
                        </span>
                      </div>
                      <p className="text-sm text-dark/70 mt-1.5">
                        {hotel.description}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-sage/30 bg-sage/20 p-5">
                  <p className="text-sm text-dark/70 italic">
                    {t.lodging.noRoomFallback}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Venue */}
      <section>
        <h2 className="text-2xl font-heading text-deep-sage mb-4">
          {t.lodging.theVenue}
        </h2>
        <div className="rounded-xl border border-sage/30 bg-sage/20 p-6">
          <h3 className="font-medium text-dark mb-1">Belle Meade Mansion</h3>
          <p className="text-sm mb-3">
            <a
              href="https://www.google.com/maps/search/?api=1&query=110+Leake+Ave%2C+Nashville%2C+TN+37205"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#5C3D2E] underline underline-offset-2 decoration-sage hover:text-deep-sage transition-colors"
            >
              110 Leake Ave, Nashville, TN 37205
            </a>
          </p>
          <p className="text-sm text-dark/70">
            {t.lodging.venueDesc}
          </p>
        </div>
      </section>
    </div>
  );
}
