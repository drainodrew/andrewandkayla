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
    <div className="flex justify-center items-center gap-0">
      {units.map(({ value, label }, i) => (
        <div key={label} className="flex items-center">
          <div className="text-center px-4 sm:px-6">
            <span className="block text-3xl sm:text-5xl font-heading text-pink">
              {value}
            </span>
            <span className="text-[10px] sm:text-xs uppercase tracking-[0.2em] text-dark/50 mt-1 block">
              {label}
            </span>
          </div>
          {i < units.length - 1 && (
            <div className="w-px h-10 sm:h-14 bg-dark/15" />
          )}
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
        {/* Hero illustration - full width, edge to edge */}
        <div className="w-full px-4 sm:px-8 pt-2">
          <Image
            src="/images/graphics/hero-illustration.png"
            alt="Illustration of Andrew and Kayla dancing at their wedding celebration"
            width={1800}
            height={600}
            className="w-full h-auto object-contain"
            priority
          />
        </div>

        {/* Text content */}
        <div className="flex flex-col items-center px-4 mt-6 sm:mt-10">
          <p className="text-xs sm:text-sm uppercase tracking-[0.3em] text-deep-sage mb-4">
            We&apos;re Getting Married!
          </p>

          {/* Decorative flourish */}
          <div className="flex items-center gap-2 mb-2">
            <svg width="24" height="12" viewBox="0 0 24 12" className="text-deep-sage/40">
              <path d="M0 6 Q6 0 12 6 Q18 12 24 6" fill="none" stroke="currentColor" strokeWidth="1" />
            </svg>
          </div>

          <h1
            className="text-5xl sm:text-7xl lg:text-8xl text-pink mb-4 sm:mb-6"
            style={{ fontFamily: "var(--font-hero)" }}
          >
            Andrew & Kayla
          </h1>

          <p className="text-xs sm:text-sm uppercase tracking-[0.25em] text-dark/80 mb-1 sm:mb-2">
            August 29, 2026
          </p>
          <p className="text-xs sm:text-sm uppercase tracking-[0.2em] text-dark/60 mb-8 sm:mb-10">
            Belle Meade Mansion &nbsp;&bull;&nbsp; Nashville, Tennessee
          </p>

          <Countdown targetDate="2026-08-29T17:00:00-05:00" />

          <Link
            href="/rsvp"
            className="mt-8 sm:mt-10 inline-block rounded-sm bg-pink px-10 sm:px-14 py-3 text-sm uppercase tracking-[0.2em] font-medium text-deep-sage transition-colors hover:bg-pink/80 focus:outline-none focus:ring-2 focus:ring-sage"
          >
            RSVP Now
          </Link>

          {/* Down arrow */}
          <div className="mt-8 sm:mt-12 mb-8 animate-bounce">
            <svg width="20" height="20" viewBox="0 0 20 20" className="text-dark/30">
              <path d="M4 7 L10 13 L16 7" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </div>
      </section>

      {/* Quick Links */}
      <section className="text-center px-4 pb-16 max-w-4xl mx-auto">
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
