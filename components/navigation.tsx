"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLanguage, getTranslations } from "@/lib/i18n";

const THEKNOT_REGISTRY_URL = "https://registry.theknot.com/andrew-manuel-kayla-wegner-august-2026-tn/78471685";

const NAV_HREFS = [
  "/",
  "/what-to-wear",
  "/schedule",
  "/lodging",
  "/things-to-do",
  "/faq",
  THEKNOT_REGISTRY_URL,
] as const;

export function Navigation() {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();
  const { lang, setLang } = useLanguage();
  const t = getTranslations(lang);

  const navLinks = NAV_HREFS.map((href) => ({
    href,
    label:
      href === "/"
        ? t.nav.home
        : href === "/what-to-wear"
          ? t.nav.whatToWear
          : href === "/schedule"
            ? t.nav.schedule
            : href === "/lodging"
              ? t.nav.lodging
              : href === "/things-to-do"
                ? t.nav.thingsToDo
                : href === "/faq"
                  ? t.nav.faq
                  : t.nav.registry,
    external: href === THEKNOT_REGISTRY_URL,
  }));

  return (
    <nav className="sticky top-0 z-50 bg-cream/95 backdrop-blur-sm border-b border-sage/30">
      <div className="mx-auto max-w-5xl px-4 py-4 flex items-center justify-between">
        <Link
          href="/"
          className="font-heading text-xl text-deep-sage tracking-wide"
        >
          A & K
        </Link>

        {/* Desktop nav */}
        <ul className="hidden md:flex items-center gap-6">
          {navLinks.map(({ href, label, external }) => (
            <li key={href}>
              {external ? (
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium text-dark/70 transition-colors hover:text-deep-sage"
                >
                  {label}
                </a>
              ) : (
                <Link
                  href={href}
                  className={`text-sm font-medium transition-colors hover:text-deep-sage ${
                    pathname === href
                      ? "text-deep-sage underline underline-offset-4 decoration-pink decoration-2"
                      : "text-dark/70"
                  }`}
                >
                  {label}
                </Link>
              )}
            </li>
          ))}
          <li>
            <Link
              href="/rsvp"
              className={`rounded-full px-5 py-1.5 text-sm font-medium transition-colors ${
                pathname === "/rsvp"
                  ? "bg-pink text-dark"
                  : "bg-pink text-dark hover:bg-pink/80"
              }`}
            >
              {t.nav.rsvp}
            </Link>
          </li>
          <li>
            <button
              type="button"
              onClick={() => setLang(lang === "en" ? "es" : "en")}
              className="text-xs font-medium text-dark/50 hover:text-deep-sage transition-colors border border-sage/30 rounded-full px-3 py-1"
              aria-label={lang === "en" ? "Switch to Spanish" : "Cambiar a Inglés"}
            >
              {lang === "en" ? "ES" : "EN"}
            </button>
          </li>
        </ul>

        {/* Mobile: language toggle + hamburger */}
        <div className="md:hidden flex items-center gap-3">
          <button
            type="button"
            onClick={() => setLang(lang === "en" ? "es" : "en")}
            className="text-xs font-medium text-dark/50 hover:text-deep-sage transition-colors border border-sage/30 rounded-full px-3 py-1"
            aria-label={lang === "en" ? "Switch to Spanish" : "Cambiar a Inglés"}
          >
            {lang === "en" ? "ES" : "EN"}
          </button>
          <button
            type="button"
            className="p-2 rounded-md focus:outline-none focus:ring-2 focus:ring-pink"
            onClick={() => setIsOpen(!isOpen)}
            aria-expanded={isOpen}
            aria-label="Toggle navigation menu"
          >
            <svg
              className="h-6 w-6 text-deep-sage"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              {isOpen ? (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 18L18 6M6 6l12 12"
                />
              ) : (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
                />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile nav */}
      {isOpen && (
        <div className="md:hidden border-t border-sage/30 bg-cream">
          <ul className="flex flex-col px-4 py-2">
            {navLinks.map(({ href, label, external }) => (
              <li key={href}>
                {external ? (
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block py-3 text-sm font-medium text-dark/70 transition-colors hover:text-deep-sage"
                    onClick={() => setIsOpen(false)}
                  >
                    {label}
                  </a>
                ) : (
                  <Link
                    href={href}
                    className={`block py-3 text-sm font-medium transition-colors ${
                      pathname === href
                        ? "text-deep-sage"
                        : "text-dark/70 hover:text-deep-sage"
                    }`}
                    onClick={() => setIsOpen(false)}
                  >
                    {label}
                  </Link>
                )}
              </li>
            ))}
            <li className="pt-2 pb-3">
              <Link
                href="/rsvp"
                className="block text-center rounded-full bg-pink px-5 py-2 text-sm font-medium text-dark"
                onClick={() => setIsOpen(false)}
              >
                {t.nav.rsvp}
              </Link>
            </li>
          </ul>
        </div>
      )}
    </nav>
  );
}
