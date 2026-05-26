"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";

function Countdown({ targetDate }: { targetDate: string }) {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });

  useEffect(() => {
    const target = new Date(targetDate).getTime();

    function update() {
      const now = Date.now();
      const diff = Math.max(0, target - now);
      setTimeLeft({
        days: Math.floor(diff / (1000 * 60 * 60 * 24)),
        hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
        minutes: Math.floor((diff / (1000 * 60)) % 60),
        seconds: Math.floor((diff / 1000) % 60),
      });
    }

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [targetDate]);

  const units = [
    { value: timeLeft.days, label: "Days" },
    { value: timeLeft.hours, label: "Hours" },
    { value: timeLeft.minutes, label: "Minutes" },
    { value: timeLeft.seconds, label: "Seconds" },
  ];

  return (
    <div className="flex justify-center gap-6 sm:gap-10">
      {units.map(({ value, label }) => (
        <div key={label} className="text-center">
          <span className="block text-3xl sm:text-5xl font-heading text-pink">
            {value}
          </span>
          <span className="text-[10px] sm:text-xs uppercase tracking-[0.2em] text-dark/50 mt-1 block">
            {label}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function Home() {
  return (
    <div>
      {/* Hero section */}
      <section className="flex flex-col items-center text-center">
        {/* Hero illustration - full width, sage green tinted */}
        <div className="w-full px-4 sm:px-8 pt-2">
          <Image
            src="/images/graphics/hero-illustration-v2.png"
            alt="Illustration of Andrew and Kayla dancing at their wedding celebration"
            width={1800}
            height={600}
            className="w-full h-auto object-contain mix-blend-multiply"
            style={{
              filter: "sepia(100%) hue-rotate(60deg) saturate(40%) brightness(1.1) opacity(0.85)",
            }}
            priority
          />
        </div>

        {/* Text content */}
        <div className="flex flex-col items-center px-4 mt-6 sm:mt-10">
          <p
            className="text-base sm:text-lg text-deep-sage mb-3 tracking-[0.15em]"
            style={{ fontFamily: "var(--font-hero)" }}
          >
            We&apos;re Getting Married!
          </p>

          {/* Decorative leaf flourish */}
          <div className="flex items-center gap-0 mb-3">
            <svg width="80" height="16" viewBox="0 0 80 16" className="text-deep-sage/50">
              {/* Left branch */}
              <line x1="0" y1="8" x2="34" y2="8" stroke="currentColor" strokeWidth="0.75" />
              {/* Leaves on left */}
              <path d="M12 8 Q14 4 18 6 Q14 7 12 8Z" fill="currentColor" opacity="0.7" />
              <path d="M20 8 Q22 4 26 6 Q22 7 20 8Z" fill="currentColor" opacity="0.7" />
              <path d="M14 8 Q16 12 20 10 Q16 9 14 8Z" fill="currentColor" opacity="0.6" />
              <path d="M22 8 Q24 12 28 10 Q24 9 22 8Z" fill="currentColor" opacity="0.6" />
              {/* Center leaf cluster */}
              <path d="M36 8 Q40 2 44 8 Q40 14 36 8Z" fill="currentColor" opacity="0.5" />
              <path d="M38 6 Q40 1 42 6" fill="none" stroke="currentColor" strokeWidth="0.5" />
              {/* Right branch */}
              <line x1="46" y1="8" x2="80" y2="8" stroke="currentColor" strokeWidth="0.75" />
              {/* Leaves on right */}
              <path d="M54 8 Q56 4 60 6 Q56 7 54 8Z" fill="currentColor" opacity="0.7" />
              <path d="M62 8 Q64 4 68 6 Q64 7 62 8Z" fill="currentColor" opacity="0.7" />
              <path d="M56 8 Q58 12 62 10 Q58 9 56 8Z" fill="currentColor" opacity="0.6" />
              <path d="M64 8 Q66 12 70 10 Q66 9 64 8Z" fill="currentColor" opacity="0.6" />
            </svg>
          </div>

          <h1
            className="text-5xl sm:text-7xl lg:text-8xl text-pink mb-4 sm:mb-6"
            style={{ fontFamily: "var(--font-hero)" }}
          >
            Andrew & Kayla
          </h1>

          <p className="text-xs sm:text-sm uppercase tracking-[0.25em] text-[#5C3D2E] mb-1 sm:mb-2">
            August 29, 2026
          </p>
          <p
            className="text-base sm:text-lg text-deep-sage mb-8 sm:mb-10"
            style={{ fontFamily: "var(--font-hero)" }}
          >
            Belle Meade Mansion &nbsp;&bull;&nbsp; Nashville, Tennessee
          </p>

          <Countdown targetDate="2026-08-29T17:00:00-05:00" />

          <Link
            href="/rsvp"
            className="mt-8 inline-block rounded-lg bg-pink px-8 py-3 text-[#5C3D2E] transition-colors hover:bg-pink/80 focus:outline-none focus:ring-2 focus:ring-sage"
            style={{ fontFamily: "var(--font-hero)" }}
          >
            RSVP Here
          </Link>

          <div className="mb-24 sm:mb-32" />
        </div>
      </section>

      {/* Quick Links */}
      <section className="text-center px-4 pb-16 pt-8 max-w-4xl mx-auto border-t border-sage/20">
        <h2 className="text-2xl font-heading text-deep-sage mb-8">
          While You&apos;re Here
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "Schedule", href: "/schedule" },
            { label: "Lodging", href: "/lodging" },
            { label: "Things To Do", href: "/things-to-do" },
            { label: "FAQ", href: "/faq" },
          ].map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-xl border border-sage/30 bg-white p-4 text-sm font-medium text-dark transition-colors hover:border-pink hover:bg-pink/5 focus:outline-none focus:ring-2 focus:ring-sage"
            >
              {link.label}
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
