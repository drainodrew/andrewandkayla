"use client";

import { createContext, useContext, useState, useEffect, type ReactNode } from "react";

export type Lang = "en" | "es";

interface LanguageContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
}

const LanguageContext = createContext<LanguageContextValue>({
  lang: "en",
  setLang: () => {},
});

/**
 * Reads the saved language preference from the `lang` cookie.
 * Falls back to "en" if not set or invalid.
 */
function getSavedLang(): Lang {
  if (typeof document === "undefined") return "en";
  const match = document.cookie.match(/(?:^|;\s*)lang=(en|es)/);
  return (match?.[1] as Lang) || "en";
}

function saveLang(lang: Lang) {
  // First-party cookie, expires in 2 years
  document.cookie = `lang=${lang};path=/;max-age=${60 * 60 * 24 * 730};SameSite=Lax`;
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setLangState(getSavedLang());
    setMounted(true);
  }, []);

  function setLang(newLang: Lang) {
    setLangState(newLang);
    saveLang(newLang);
  }

  // Prevent hydration mismatch: render "en" on server, real value after mount
  const value = { lang: mounted ? lang : "en", setLang };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
