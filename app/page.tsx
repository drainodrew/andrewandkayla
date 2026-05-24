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

  return (
    <div className="flex justify-center gap-6 sm:gap-10">
      {[
        { value: timeLeft.days, label: "Days" },
        { value: timeLeft.hours, label: "Hours" },
        { value: timeLeft.minutes, label: "Minutes" },
        { value: timeLeft.seconds, label: "Seconds" },
      ].map(({ value, label }) => (
        <div key={label} className="text-center">
          <span className="block text-3xl sm:text-4xl font-heading text-deep-sage">
            {value}
          </span>
          <span className="text-xs uppercase tracking-wider text-dark/50">
            {label}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function Home() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-16">
      {/* Hero - full viewport height, accounts for nav */}
      <section className="min-h-[calc(100vh-73px)] flex flex-col items-center justify-center text-center mb-16 -mt-16 pt-16">
        <h1
          className="text-5xl sm:text-6xl text-deep-sage mb-4"
          style={{ fontFamily: "var(--font-hero)" }}
        >
          Andrew & Kayla
        </h1>
        <p className="text-lg text-dark/80 mb-2">
          Saturday, August 29, 2026
        </p>
        <p className="text-dark/60 mb-8">
          Belle Meade Mansion &middot; Nashville, Tennessee
        </p>

        <div className="w-full max-w-2xl overflow-hidden rounded-2xl">
          <Image
            src="/images/photos/beach.jpg"
            alt="Andrew and Kayla on the beach"
            width={1200}
            height={750}
            className="w-full h-auto object-cover"
            priority
          />
        </div>

        <div className="mt-8">
          <Countdown targetDate="2026-08-29T17:00:00-05:00" />
        </div>

        <Link
          href="/rsvp"
          className="mt-8 inline-block rounded-lg bg-pink px-8 py-3 font-medium text-dark transition-colors hover:bg-pink/80 focus:outline-none focus:ring-2 focus:ring-sage"
        >
          RSVP Now
        </Link>
      </section>

      {/* Quick Links */}
      <section className="text-center">
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
