"use client";

import { useLanguage, getTranslations } from "@/lib/i18n";
import { RsvpFlow } from "@/components/rsvp/rsvp-flow";

export default function RSVPPage() {
  const { lang } = useLanguage();
  const t = getTranslations(lang);

  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="text-4xl font-heading text-deep-sage mb-2 text-center">
        {t.rsvp.title}
      </h1>
      <p className="text-center text-dark/60 mb-10">
        {t.rsvp.subtitle}
      </p>
      <RsvpFlow />
    </div>
  );
}
