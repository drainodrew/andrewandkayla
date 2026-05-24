"use client";

import { useEffect } from "react";
import Image from "next/image";
import Link from "next/link";

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

/**
 * Timeline event icons as inline SVGs, inspired by the Details Card illustrations.
 * Each matches a wedding event phase.
 */
function CeremonyIcon() {
  return (
    <svg viewBox="0 0 64 64" className="w-full h-full" fill="none" stroke="#5C6B4E" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      {/* Champagne glasses toasting */}
      <path d="M20 16l4 20M44 16l-4 20" />
      <path d="M16 16h8M40 16h8" />
      <ellipse cx="20" cy="14" rx="5" ry="3" />
      <ellipse cx="44" cy="14" rx="5" ry="3" />
      <path d="M24 36h16" />
      <path d="M28 36v8h8v-8" />
      {/* Hearts */}
      <path d="M30 10c0-2 2-4 4-2s4 0 4 2-4 6-4 6-4-4-4-6z" fill="#F8BBDB" stroke="#F8BBDB" />
    </svg>
  );
}

function CocktailIcon() {
  return (
    <svg viewBox="0 0 64 64" className="w-full h-full" fill="none" stroke="#5C6B4E" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      {/* Cocktail glass */}
      <path d="M18 14h28L32 36z" />
      <path d="M32 36v14" />
      <path d="M24 50h16" />
      {/* Olive */}
      <circle cx="38" cy="22" r="2.5" fill="#C5D0B3" stroke="#5C6B4E" />
      <path d="M38 19v-3" />
      {/* Bubbles */}
      <circle cx="26" cy="20" r="1" fill="#F8BBDB" />
      <circle cx="30" cy="17" r="0.8" fill="#F8BBDB" />
    </svg>
  );
}

function DinnerIcon() {
  return (
    <svg viewBox="0 0 64 64" className="w-full h-full" fill="none" stroke="#5C6B4E" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      {/* Plate */}
      <circle cx="32" cy="34" r="14" />
      <circle cx="32" cy="34" r="10" strokeDasharray="3 2" />
      {/* Fork */}
      <path d="M14 18v28M12 18v8a2 2 0 004 0v-8M16 18v8" />
      {/* Knife */}
      <path d="M50 18v28M50 18c2 0 3 3 3 6s-1 5-3 5" />
    </svg>
  );
}

function DanceIcon() {
  return (
    <svg viewBox="0 0 64 64" className="w-full h-full" fill="none" stroke="#5C6B4E" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      {/* Dancing couple silhouette */}
      <circle cx="26" cy="14" r="4" />
      <circle cx="38" cy="12" r="4" />
      <path d="M26 18v12l-4 14M26 30l4 14M26 24h4" />
      <path d="M38 16v14l4 14M38 30l-4 14M38 22h-4" />
      {/* Music notes */}
      <path d="M46 10c2-1 4 0 3 2s-3 2-3 2v8" fill="#F8BBDB" stroke="#F8BBDB" strokeWidth="1" />
      <circle cx="46" cy="22" r="2" fill="#F8BBDB" stroke="#F8BBDB" strokeWidth="1" />
      <path d="M16 16c-2-1-3 1-2 2s2 1 2 1v6" fill="#F8BBDB" stroke="#F8BBDB" strokeWidth="1" />
      <circle cx="16" cy="25" r="1.5" fill="#F8BBDB" stroke="#F8BBDB" strokeWidth="1" />
    </svg>
  );
}

function FarewellIcon() {
  return (
    <svg viewBox="0 0 64 64" className="w-full h-full" fill="none" stroke="#5C6B4E" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      {/* Car silhouette */}
      <path d="M8 38h48v6H8z" />
      <path d="M14 38l4-10h20l6 10" />
      <circle cx="18" cy="46" r="4" />
      <circle cx="46" cy="46" r="4" />
      {/* Speed lines */}
      <path d="M4 36h4M2 40h6M4 42h4" strokeWidth="1" opacity="0.5" />
      {/* Heart */}
      <path d="M34 28c0-1.5 1.5-3 3-1.5s3 0 3 1.5-3 4.5-3 4.5-3-3-3-4.5z" fill="#F8BBDB" stroke="#F8BBDB" strokeWidth="0.8" />
    </svg>
  );
}

interface TimelineEvent {
  title: string;
  time: string;
  description: string;
  icon: React.ReactNode;
}

const WEDDING_DAY_EVENTS: TimelineEvent[] = [
  {
    title: "Welcome & Ceremony",
    time: "5:15 PM",
    description:
      "Please arrive at 5:15pm to enjoy light grazing and welcome drinks as we gather for the ceremony.",
    icon: <CeremonyIcon />,
  },
  {
    title: "Cocktail Hour",
    time: "6:15 PM",
    description:
      "Guests are invited to enjoy drinks, light bites, and games.",
    icon: <CocktailIcon />,
  },
  {
    title: "Dinner",
    time: "7:00 PM",
    description: "Gather with us for a seated dinner and toasts.",
    icon: <DinnerIcon />,
  },
  {
    title: "Continued Celebration",
    time: "8:00 PM",
    description:
      "Join us on the dance floor for live music and dessert.",
    icon: <DanceIcon />,
  },
  {
    title: "Farewell",
    time: "11:00 PM",
    description:
      "The evening concludes with a joyful send-off. Thank you for celebrating with us!",
    icon: <FarewellIcon />,
  },
];

function WavyDivider() {
  return (
    <svg
      viewBox="0 0 1200 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="w-full h-8"
      preserveAspectRatio="none"
    >
      <path
        d="M0 20C100 20 100 5 200 5C300 5 300 35 400 35C500 35 500 5 600 5C700 5 700 35 800 35C900 35 900 5 1000 5C1100 5 1100 20 1200 20"
        stroke="#C5D0B3"
        strokeWidth="2.5"
        fill="none"
      />
    </svg>
  );
}

function ColorBand({
  bg,
  children,
  className = "",
}: {
  bg: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw] w-screen ${bg} ${className}`}>
      <div className="mx-auto max-w-4xl px-4">{children}</div>
    </div>
  );
}

export default function SchedulePage() {
  useScrollAnimations();

  return (
    <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8 overflow-hidden">
      {/* Header */}
      <div className="text-center mb-12 animate-on-scroll">
        <h1 className="text-4xl sm:text-5xl font-heading text-deep-sage mb-3">
          Wedding Timeline
        </h1>
        <p className="text-dark/60 max-w-md mx-auto leading-relaxed">
          All wedding day festivities will be hosted at Belle Meade Mansion.
        </p>
        <Link
          href="/what-to-wear"
          className="inline-block mt-3 text-sm text-deep-sage font-medium underline underline-offset-4 decoration-pink decoration-2 hover:text-pink transition-colors"
        >
          Garden Formal attire
        </Link>
      </div>

      {/* ===== WEDDING DAY TIMELINE (pink bg) ===== */}
      <ColorBand bg="bg-pink/15" className="py-12 sm:py-16">
        <h2 className="text-2xl font-heading text-deep-sage mb-10 text-center animate-on-scroll">
          Saturday, August 29
        </h2>

        {/* Vertical timeline */}
        <div className="relative">
          {/* Center line */}
          <div className="absolute left-8 sm:left-1/2 top-0 bottom-0 w-px bg-sage/40 sm:-translate-x-px" />

          {WEDDING_DAY_EVENTS.map((event, i) => {
            const isLeft = i % 2 === 0;
            return (
              <div
                key={event.title}
                className="animate-on-scroll relative mb-12 last:mb-0"
                style={{ animationDelay: `${i * 120}ms` }}
              >
                {/* Timeline dot */}
                <div className="absolute left-8 sm:left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-pink border-2 border-white shadow-sm z-10" />

                {/* Card: alternates sides on desktop, always right on mobile */}
                <div
                  className={`ml-16 sm:ml-0 sm:w-[calc(50%-2rem)] ${
                    isLeft ? "sm:mr-auto sm:pr-8" : "sm:ml-auto sm:pl-8"
                  }`}
                >
                  <div className="group rounded-2xl border-2 border-dashed border-sage/30 bg-white p-5 sm:p-6 hover:border-pink/50 hover:shadow-lg transition-all duration-300">
                    {/* Icon */}
                    <div className="w-14 h-14 mb-3 mx-auto group-hover:scale-110 transition-transform duration-300">
                      {event.icon}
                    </div>

                    <h3 className="font-heading text-deep-sage text-lg text-center mb-1">
                      {event.title}
                    </h3>
                    <p className="text-center text-sm font-medium text-pink mb-2">
                      {event.time}
                    </p>
                    <p className="text-sm text-dark/60 text-center leading-relaxed">
                      {event.description}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </ColorBand>

      {/* ===== FRIDAY GAME DAY (sage bg) ===== */}
      <ColorBand bg="bg-sage/15" className="py-12 sm:py-16">
        <div className="animate-on-scroll relative text-center overflow-visible">
          {/* Tennis illustration */}
          <div className="absolute -bottom-6 -right-6 w-36 sm:w-48 opacity-40 pointer-events-none rotate-[5deg]">
            <Image
              src="/images/graphics/gameday graphic.jpeg"
              alt=""
              width={300}
              height={300}
              className="w-full h-auto"
              aria-hidden="true"
            />
          </div>

          <h2 className="text-2xl sm:text-3xl font-heading text-deep-sage mb-2 relative z-10">
            Friday Festivities
          </h2>
          <p className="text-sm text-pink font-medium mb-4 relative z-10">
            Friday, August 28 &middot; 12:30 PM to 3:30 PM
          </p>
          <p className="text-dark/70 leading-relaxed max-w-md mx-auto mb-4 relative z-10">
            Join us for an afternoon of games, snacks, and friendly competition.
          </p>
          <div className="text-sm text-dark/50 relative z-10">
            <p>1422 Franklin Rd</p>
            <p>Brentwood, TN 37027</p>
          </div>
        </div>
      </ColorBand>

      {/* ===== COUPLE ILLUSTRATION FOOTER ===== */}
      <section className="mt-12 text-center animate-on-scroll">
        <div className="max-w-[200px] mx-auto mb-6">
          <Image
            src="/images/graphics/IMG_5258.jpeg"
            alt="Kayla and Andrew illustration"
            width={300}
            height={400}
            className="w-full h-auto opacity-70 hover:opacity-100 transition-opacity duration-500"
          />
        </div>
        <Link
          href="/rsvp"
          className="inline-block rounded-full bg-pink px-8 py-3 font-medium text-dark transition-all hover:bg-pink/80 hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-sage shadow-md"
        >
          RSVP to All Events
        </Link>
      </section>
    </div>
  );
}
