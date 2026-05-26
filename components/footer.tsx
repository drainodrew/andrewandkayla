"use client";

import { useLanguage, getTranslations } from "@/lib/i18n";

export function Footer() {
  const { lang } = useLanguage();
  const t = getTranslations(lang);

  return (
    <footer className="py-8 text-center text-sm text-deep-sage">
      <p>{t.footer.line}</p>
    </footer>
  );
}
