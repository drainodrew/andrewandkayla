"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/schedule", label: "Schedule" },
  { href: "/lodging", label: "Lodging" },
  { href: "/things-to-do", label: "Things To Do" },
  { href: "/faq", label: "FAQ" },
  { href: "/registry", label: "Registry" },
] as const;

export function Navigation() {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

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
          {NAV_LINKS.map(({ href, label }) => (
            <li key={href}>
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
              RSVP
            </Link>
          </li>
        </ul>

        {/* Hamburger button */}
        <button
          type="button"
          className="md:hidden p-2 rounded-md focus:outline-none focus:ring-2 focus:ring-pink"
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

      {/* Mobile nav */}
      {isOpen && (
        <div className="md:hidden border-t border-sage/30 bg-cream">
          <ul className="flex flex-col px-4 py-2">
            {NAV_LINKS.map(({ href, label }) => (
              <li key={href}>
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
              </li>
            ))}
            <li className="pt-2 pb-3">
              <Link
                href="/rsvp"
                className="block text-center rounded-full bg-pink px-5 py-2 text-sm font-medium text-dark"
                onClick={() => setIsOpen(false)}
              >
                RSVP
              </Link>
            </li>
          </ul>
        </div>
      )}
    </nav>
  );
}
