"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";

function useScrollAnimations() {
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15 }
    );
    const elements = document.querySelectorAll(
      ".animate-on-scroll, .bounce-on-scroll"
    );
    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);
}

function Countdown({ targetDate }: { targetDate: string }) {
  const [timeLeft, setTimeLeft] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
  });

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

/**
 * Full-width colored section that breaks out of the parent max-width.
 */
function FullWidthSection({
  bg,
  children,
  className = "",
  id,
}: {
  bg: string;
  children: React.ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section
      id={id}
      className={`relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw] w-screen ${bg} ${className}`}
    >
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">{children}</div>
    </section>
  );
}

const TIMELINE_EVENTS = [
  {
    title: "Welcome & Ceremony",
    time: "5:15 PM",
    description:
      "Please arrive at 5:15pm to enjoy light grazing and welcome drinks as we gather for the ceremony.",
    image: "/images/graphics/timeline/welcome & ceremony.png",
  },
  {
    title: "Cocktail Hour",
    time: "6:15 PM",
    description:
      "Guests are invited to enjoy drinks, light bites, and games.",
    image: "/images/graphics/timeline/cocktail hour.png",
  },
  {
    title: "Dinner",
    time: "7:00 PM",
    description: "Gather with us for a seated dinner and toasts.",
    image: "/images/graphics/timeline/dinner.png",
  },
  {
    title: "Continued Celebration",
    time: "8:00 PM",
    description:
      "Join us on the dance floor for live music and dessert.",
    image: "/images/graphics/timeline/continued celebration.png",
  },
  {
    title: "Farewell",
    time: "11:00 PM",
    description:
      "The evening concludes with a joyful send-off. Thank you for celebrating with us!",
    image: "/images/graphics/timeline/farewell.png",
  },
];

export default function Home() {
  useScrollAnimations();

  return (
    <div className="mx-auto max-w-4xl px-4 overflow-hidden">
      {/* ===== HERO (100vh) ===== */}
      <section className="min-h-[calc(100vh-73px)] flex flex-col items-center justify-center text-center -mt-16 pt-16">
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

      {/* ===== WEDDING TIMELINE ===== */}
      <FullWidthSection bg="bg-pink/15" className="py-16 sm:py-20" id="schedule">
        <div className="text-center mb-4 animate-on-scroll">
          <h2 className="text-3xl sm:text-4xl font-heading text-deep-sage mb-2">
            Wedding Timeline
          </h2>
          <p className="text-dark/60">
            Saturday, August 29, 2026 &middot; Belle Meade Mansion
          </p>
          <p className="text-sm text-dark/50 mt-1">
            Garden Formal attire
          </p>
        </div>

        {/* Horizontal timeline on desktop, vertical stack on mobile */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-6 sm:gap-4 mt-10">
          {TIMELINE_EVENTS.map((event, i) => (
            <div
              key={event.title}
              className="animate-on-scroll text-center"
              style={{ animationDelay: `${i * 100}ms` }}
            >
              <div className="w-28 h-28 sm:w-24 sm:h-24 mx-auto mb-3">
                <Image
                  src={event.image}
                  alt={event.title}
                  width={200}
                  height={200}
                  className="w-full h-full object-contain"
                />
              </div>
              <p className="text-lg sm:text-base font-medium text-deep-sage mb-1">
                {event.time}
              </p>
              <p className="text-xs text-dark/60 leading-relaxed">
                {event.description}
              </p>
            </div>
          ))}
        </div>

        {/* Connecting line on desktop */}
        <div className="hidden sm:block mt-[-88px] mb-[88px] mx-12">
          <div className="h-px bg-sage/40" />
        </div>
      </FullWidthSection>

      {/* ===== FRIDAY FESTIVITIES ===== */}
      <FullWidthSection bg="bg-sage/15" className="py-16 sm:py-20" id="friday">
        <div className="animate-on-scroll text-center max-w-lg mx-auto">
          <h2 className="text-3xl sm:text-4xl font-heading text-deep-sage mb-2">
            Friday Festivities
          </h2>
          <p className="text-sm text-pink font-medium mb-4">
            Friday, August 28 &middot; 12:30 PM to 3:30 PM
          </p>
          <p className="text-dark/70 leading-relaxed mb-4">
            Join us for an afternoon of games, snacks, and friendly competition.
          </p>
          <div className="text-sm text-dark/50">
            <p>1422 Franklin Rd</p>
            <p>Brentwood, TN 37027</p>
          </div>
        </div>
      </FullWidthSection>
    </div>
  );
}
