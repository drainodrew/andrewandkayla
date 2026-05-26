"use client";

import { useLanguage, getTranslations } from "@/lib/i18n";

export default function ThingsToDoPage() {
  const { lang } = useLanguage();
  const t = getTranslations(lang);
  function mapsUrl(query: string) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query + ", Nashville, TN")}`;
  }

  const categories = t.thingsToDo.categories;

  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="text-4xl font-heading text-deep-sage mb-2 text-center">
        {t.thingsToDo.title}
      </h1>
      <p className="text-center text-dark/60 mb-12">
        {t.thingsToDo.subtitle}
      </p>

      <div className="space-y-12">
        {categories.map((category) => (
          <section key={category.title}>
            <h2 className="text-2xl font-heading text-deep-sage mb-1">
              {category.title}
            </h2>
            <p className="text-sm text-dark/60 mb-6">{category.description}</p>
            <div className="space-y-4">
              {category.spots.map((spot) => (
                <div
                  key={spot.name}
                  className="rounded-xl border border-sage/30 bg-sage/20 p-6"
                >
                  <div className="flex items-start justify-between gap-4 mb-2">
                    <div className="flex items-center gap-3">
                      <a
                        href={mapsUrl(spot.mapsQuery)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-dark hover:text-pink transition-colors"
                      >
                        {spot.name}
                      </a>
                      <span className="shrink-0 rounded-full bg-sage/20 px-3 py-0.5 text-xs font-medium text-deep-sage">
                        {spot.type}
                      </span>
                    </div>
                    <span className="shrink-0 text-xs text-dark/50">
                      {spot.proximity}
                    </span>
                  </div>
                  <p className="text-sm text-dark/70">{spot.description}</p>
                  {spot.tip && (
                    <p className="text-sm text-dark/50 mt-2 italic">
                      {spot.tip}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>

      <div className="mt-12 rounded-xl border border-pink/30 bg-pink/5 p-6 text-center">
        <p className="text-sm text-dark/70">
          {t.thingsToDo.moreRecs}
        </p>
      </div>
    </div>
  );
}
