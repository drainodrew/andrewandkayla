"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { useLanguage, getTranslations } from "@/lib/i18n";

function Countdown({ targetDate }: { targetDate: string }) {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const { lang } = useLanguage();
  const t = getTranslations(lang);

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
    { value: timeLeft.days, label: t.home.days },
    { value: timeLeft.hours, label: t.home.hours },
    { value: timeLeft.minutes, label: t.home.minutes },
    { value: timeLeft.seconds, label: t.home.seconds },
  ];

  return (
    <div className="flex justify-center gap-5 sm:gap-10">
      {units.map(({ value, label }) => (
        <div key={label} className="text-center">
          <span className="block text-3xl sm:text-5xl font-heading text-pink">
            {value}
          </span>
          <span className="text-[10px] sm:text-xs uppercase tracking-[0.2em] text-sage mt-1 block">
            {label}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function Home() {
  const { lang } = useLanguage();
  const t = getTranslations(lang);

  return (
    <div>
      {/* Hero section - nav + hero = 100vh on mobile */}
      <section className="flex flex-col items-center text-center h-[calc(100svh-64px)] sm:h-auto overflow-hidden sm:overflow-visible justify-between sm:justify-start">

        {/* Mobile layout: tagline, name, then image */}
        <div className="sm:hidden flex flex-col items-center px-4 pt-8">
          <p
            className="text-sm text-[#5C3D2E]/50 mb-2 tracking-[0.15em]"
            style={{ fontFamily: "var(--font-hero)" }}
          >
            {t.home.tagline}
          </p>
          <h1
            className="text-[2.6rem] min-[430px]:text-5xl text-pink/90 mb-4 leading-tight whitespace-nowrap"
            style={{ fontFamily: "var(--font-hero)" }}
          >
            Andrew & Kayla
          </h1>
        </div>

        {/* Hero illustration */}
        <div className="w-full px-0 sm:px-8 sm:pt-2 sm:max-h-none overflow-hidden">
          <Image
            src="/images/graphics/hero-v3.jpg"
            alt="Illustration of Andrew and Kayla dancing at their wedding celebration"
            width={1800}
            height={600}
            className="w-full h-auto object-contain"
            priority
          />
        </div>

        {/* Desktop: tagline and name after image */}
        <div className="hidden sm:flex flex-col items-center px-4 mt-10">
          <p
            className="text-lg text-[#5C3D2E]/50 mb-3 tracking-[0.15em]"
            style={{ fontFamily: "var(--font-hero)" }}
          >
            {t.home.tagline}
          </p>
          <h1
            className="text-7xl lg:text-8xl text-pink mb-6"
            style={{ fontFamily: "var(--font-hero)" }}
          >
            Andrew & Kayla
          </h1>
        </div>

        {/* Shared content: date, venue, countdown, RSVP */}
        <div className="flex flex-col items-center px-4 mt-3 sm:mt-0">
          <p className="text-xs sm:text-sm uppercase tracking-[0.25em] text-dark/50 mb-1 sm:mb-2">
            {t.home.date}
          </p>
          {/* Mobile: venue */}
          <div
            className="sm:hidden text-[#5C3D2E]/40 mt-2 mb-6 text-center"
            style={{ fontFamily: "var(--font-hero)" }}
          >
            <p className="text-[15px]">{t.home.venue}</p>
            <p className="text-[13px]">{t.home.city}</p>
          </div>
          {/* Desktop: venue */}
          <p
            className="hidden sm:block text-lg text-[#5C3D2E]/40 mb-10"
            style={{ fontFamily: "var(--font-hero)" }}
          >
            {t.home.venueFull}
          </p>

          <Countdown targetDate="2026-08-29T17:15:00-05:00" />

          <Link
            href="/rsvp"
            className="mt-8 sm:mt-10 inline-block rounded-lg bg-pink px-8 py-3 text-[#5C3D2E]/40 transition-colors hover:bg-pink/80 focus:outline-none focus:ring-2 focus:ring-sage"
            style={{ fontFamily: "var(--font-hero)" }}
          >
            {t.home.rsvp}
          </Link>

          <div className="mb-6 sm:mb-32" />
        </div>
      </section>

      {/* Quick Links */}
      <section className="text-center px-4 pb-16 pt-8 max-w-4xl mx-auto border-t border-sage/20">
        <h2 className="text-2xl font-heading text-deep-sage mb-8">
          {t.home.whileYoureHere}
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: t.home.linkSchedule, href: "/schedule" },
            { label: t.home.linkLodging, href: "/lodging" },
            { label: t.home.linkThingsToDo, href: "/things-to-do" },
            { label: t.home.linkFaq, href: "/faq" },
          ].map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-xl border border-sage/30 bg-sage/20 p-4 text-sm font-medium text-[#5C3D2E] transition-colors hover:border-pink hover:bg-pink/5 focus:outline-none focus:ring-2 focus:ring-sage"
            >
              {link.label}
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
