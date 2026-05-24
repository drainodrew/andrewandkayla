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
    <div className="flex justify-center gap-4 sm:gap-8">
      {[
        { value: timeLeft.days, label: "Days" },
        { value: timeLeft.hours, label: "Hours" },
        { value: timeLeft.minutes, label: "Min" },
        { value: timeLeft.seconds, label: "Sec" },
      ].map(({ value, label }) => (
        <div key={label} className="text-center">
          <span className="flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 rounded-xl bg-deep-sage text-white text-2xl sm:text-3xl font-heading">
            {String(value).padStart(2, "0")}
          </span>
          <span className="block mt-1 text-[10px] sm:text-xs uppercase tracking-wider text-dark/50">
            {label}
          </span>
        </div>
      ))}
    </div>
  );
}

function WavyDivider({ color = "#C5D0B3" }: { color?: string }) {
  return (
    <svg
      viewBox="0 0 1200 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="w-full h-8 sm:h-10"
      preserveAspectRatio="none"
    >
      <path
        d="M0 20C100 20 100 5 200 5C300 5 300 35 400 35C500 35 500 5 600 5C700 5 700 35 800 35C900 35 900 5 1000 5C1100 5 1100 20 1200 20"
        stroke={color}
        strokeWidth="2.5"
        fill="none"
      />
    </svg>
  );
}

/**
 * Full-width colored section band. Breaks out of parent max-width
 * to fill the viewport, while keeping inner content centered.
 */
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

export default function Home() {
  useScrollAnimations();

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:py-16 overflow-hidden">
      {/* ===== HERO SECTION (cream bg, inherited) ===== */}
      <section className="min-h-[calc(100vh-73px)] flex flex-col items-center justify-center text-center mb-0 -mt-16 pt-16 relative">
        {/* Floating illustration top-right */}
        <div className="absolute -top-4 -right-8 sm:right-0 w-28 sm:w-40 opacity-70 float-gentle pointer-events-none">
          <Image
            src="/images/graphics/C6D8453E-2D9B-4DAF-A0D9-CCBB6A478571.png"
            alt=""
            width={300}
            height={300}
            className="w-full h-auto"
            aria-hidden="true"
          />
        </div>

        <h1
          className="text-5xl sm:text-7xl text-deep-sage mb-4 relative"
          style={{ fontFamily: "var(--font-hero)" }}
        >
          Andrew & Kayla
        </h1>

        <div className="w-12 h-12 mb-3 wiggle-gentle">
          <svg viewBox="0 0 24 24" fill="#F8BBDB" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
          </svg>
        </div>

        <p className="text-lg text-dark/80 mb-2">Saturday, August 29, 2026</p>
        <p className="text-dark/60 mb-8">
          Belle Meade Mansion &middot; Nashville, Tennessee
        </p>

        {/* Main photo with decorative corners */}
        <div className="relative w-full max-w-2xl">
          <div className="absolute -top-3 -left-3 w-8 h-8 border-t-2 border-l-2 border-pink rounded-tl-lg" />
          <div className="absolute -top-3 -right-3 w-8 h-8 border-t-2 border-r-2 border-pink rounded-tr-lg" />
          <div className="absolute -bottom-3 -left-3 w-8 h-8 border-b-2 border-l-2 border-pink rounded-bl-lg" />
          <div className="absolute -bottom-3 -right-3 w-8 h-8 border-b-2 border-r-2 border-pink rounded-br-lg" />

          <div className="overflow-hidden rounded-2xl">
            <Image
              src="/images/photos/beach.jpg"
              alt="Andrew and Kayla on the beach"
              width={1200}
              height={750}
              className="w-full h-auto object-cover"
              priority
            />
          </div>

          <div className="absolute -bottom-6 -right-2 sm:-right-8 rotate-[-6deg]">
            <p className="text-sm sm:text-base font-heading text-deep-sage italic">
              This is us!!
            </p>
            <svg className="w-8 h-8 text-deep-sage -mt-1 ml-4 rotate-[160deg]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 19.5l15-15m0 0H8.25m11.25 0v11.25" />
            </svg>
          </div>

          <div className="absolute -top-2 -left-2 sm:-left-12 rotate-[4deg]">
            <p className="text-sm sm:text-base font-heading text-pink">
              Getting married!!
            </p>
          </div>
        </div>

        {/* Countdown */}
        <div className="mt-14 mb-6">
          <p className="text-sm font-heading text-deep-sage mb-3 tracking-wide">The Countdown</p>
          <Countdown targetDate="2026-08-29T17:00:00-05:00" />
        </div>

        <Link
          href="/rsvp"
          className="mt-4 inline-block rounded-full bg-pink px-10 py-3 font-medium text-dark transition-all hover:bg-pink/80 hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-sage shadow-md"
        >
          RSVP Now
        </Link>
      </section>

      {/* ===== PROPOSAL SECTION (pink bg) ===== */}
      <ColorBand bg="bg-pink/20" className="py-16 sm:py-20 mt-8">
        <div className="animate-on-scroll text-center mb-8">
          <h2 className="text-3xl sm:text-4xl font-heading text-deep-sage mb-2">
            The Proposal
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 items-center">
          <div className="relative animate-on-scroll">
            <div className="relative">
              <div className="rounded-2xl overflow-hidden border-4 border-white shadow-lg rotate-[-3deg] hover:rotate-0 transition-transform duration-500">
                <Image
                  src="/images/photos/paris-garden.jpg"
                  alt="Andrew and Kayla in the garden in Paris"
                  width={600}
                  height={750}
                  className="w-full h-auto object-cover"
                />
              </div>
              <div className="absolute -bottom-8 -right-4 sm:-right-8 w-2/3 rounded-2xl overflow-hidden border-4 border-white shadow-lg rotate-[4deg] hover:rotate-0 transition-transform duration-500 z-10">
                <Image
                  src="/images/photos/proposal.jpg"
                  alt="Andrew proposing to Kayla in Paris"
                  width={400}
                  height={500}
                  className="w-full h-auto object-cover"
                />
              </div>
            </div>
          </div>

          <div className="animate-on-scroll pt-8 sm:pt-0">
            <div className="space-y-4 text-dark/80 leading-relaxed">
              <p>
                Kayla was supposed to fly home from Paris on a Sunday. I received
                her family&apos;s blessing the Monday before and I was so excited
                that I physically could not wait to propose.
              </p>
              <p>
                So I booked a flight the night before and surprised her on Saturday.
                She had no idea I wasn&apos;t in Nashville until she saw me standing
                there in the garden.
              </p>
              <p>
                We canceled her return flight and bopped around Paris and
                Florence for a week.
              </p>
            </div>
          </div>
        </div>
      </ColorBand>

      {/* ===== WHAT THIS DAY IS ABOUT (sage bg) ===== */}
      <ColorBand bg="bg-sage/15" className="py-16 sm:py-20">
        <div className="animate-on-scroll relative text-center overflow-visible">
          {/* Decorative illustrations */}
          <div className="absolute -bottom-8 -left-8 w-32 sm:w-44 opacity-40 pointer-events-none">
            <Image
              src="/images/graphics/BDF28BDB-5FDD-460F-9826-6FFE4C2F9444.png"
              alt=""
              width={300}
              height={300}
              className="w-full h-auto"
              aria-hidden="true"
            />
          </div>
          <div className="absolute -top-8 -right-8 w-24 sm:w-36 opacity-30 pointer-events-none rotate-[-10deg]">
            <Image
              src="/images/graphics/A5B42D87-6D39-4B6E-9F26-5001B574AE6A.png"
              alt=""
              width={300}
              height={300}
              className="w-full h-auto"
              aria-hidden="true"
            />
          </div>

          <h2 className="text-3xl sm:text-4xl font-heading text-deep-sage mb-6 relative z-10">
            What This Day Is About
          </h2>
          <div className="max-w-xl mx-auto space-y-4 text-dark/80 leading-relaxed relative z-10">
            <p>
              For us, this day is not only about our love for each other. It is
              the union of our families, both blood and chosen.
            </p>
            <p>
              We want to celebrate with full families, with the kids, with
              everyone who has shaped who we are. We hope to give you a day full
              of love, joy, and maybe a few tears (the good kind).
            </p>
          </div>
        </div>
      </ColorBand>

      {/* ===== PHOTO STRIP (cream bg, back to default) ===== */}
      <section className="py-12">
        <div className="grid grid-cols-2 gap-4">
          <div className="animate-on-scroll aspect-[4/5] overflow-hidden rounded-2xl border-4 border-white shadow-lg hover:shadow-xl transition-shadow duration-300">
            <Image
              src="/images/photos/roof.jpg"
              alt="Andrew and Kayla on the roof"
              width={600}
              height={750}
              className="w-full h-full object-cover hover:scale-105 transition-transform duration-700"
            />
          </div>
          <div className="animate-on-scroll aspect-[4/5] overflow-hidden rounded-2xl border-4 border-white shadow-lg hover:shadow-xl transition-shadow duration-300 mt-8">
            <Image
              src="/images/photos/formal.jpg"
              alt="Andrew and Kayla dressed up"
              width={600}
              height={750}
              className="w-full h-full object-cover hover:scale-105 transition-transform duration-700"
            />
          </div>
        </div>
      </section>

      {/* ===== ABOUT OUR WEDDING (pink bg) ===== */}
      <ColorBand bg="bg-pink/20" className="py-16 sm:py-20">
        <div className="animate-on-scroll text-center mb-10">
          <h2 className="text-3xl sm:text-4xl font-heading text-deep-sage mb-2">
            About Our Wedding
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-8 text-center">
          {[
            {
              title: "The Ceremony",
              desc: "An outdoor ceremony at the historic Belle Meade Mansion, surrounded by the beauty of the Nashville countryside.",
              icon: (
                <svg viewBox="0 0 64 64" className="w-14 h-14 mx-auto" fill="none" stroke="#5C6B4E" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="24" cy="20" r="8" />
                  <circle cx="40" cy="20" r="8" />
                  <path d="M24 28c-4 2-6 6-6 6h12" />
                  <path d="M40 28c4 2 6 6 6 6H34" />
                  <path d="M30 14c0-2 2-4 4-2s4 0 4 2-4 6-4 6-4-4-4-6z" fill="#F8BBDB" stroke="#F8BBDB" />
                  <path d="M20 48h24M32 34v14" />
                </svg>
              ),
            },
            {
              title: "The Reception",
              desc: "After cocktail hour, join us for dinner, toasts, dancing, and live music from the Cowpokes.",
              icon: (
                <svg viewBox="0 0 64 64" className="w-14 h-14 mx-auto" fill="none" stroke="#5C6B4E" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="32" cy="34" r="14" />
                  <circle cx="32" cy="34" r="10" strokeDasharray="3 2" />
                  <path d="M14 18v28M12 18v8a2 2 0 004 0v-8M16 18v8" />
                  <path d="M50 18v28M50 18c2 0 3 3 3 6s-1 5-3 5" />
                </svg>
              ),
            },
            {
              title: "The Dress Code",
              desc: "Garden Formal. Think linen suits, cocktail dresses, and anything that makes you feel amazing.",
              icon: (
                <svg viewBox="0 0 64 64" className="w-14 h-14 mx-auto" fill="none" stroke="#5C6B4E" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M24 12c0-2 4-6 8-6s8 4 8 6" />
                  <path d="M24 12l-8 6 4 4 4-4v30h16V18l4 4 4-4-8-6" />
                  <path d="M28 26h8M28 32h8" strokeDasharray="2 2" />
                </svg>
              ),
              href: "/what-to-wear",
            },
          ].map((item) => (
            <div
              key={item.title}
              className="animate-on-scroll group"
            >
              <div className="mb-4 group-hover:scale-110 transition-transform duration-300">
                {item.icon}
              </div>
              <h3 className="font-heading text-deep-sage text-lg mb-2 uppercase tracking-wide text-sm">
                {item.title}
              </h3>
              <p className="text-sm text-dark/60 leading-relaxed">{item.desc}</p>
              {item.href && (
                <Link
                  href={item.href}
                  className="inline-block mt-3 text-xs text-deep-sage font-medium underline underline-offset-4 decoration-pink decoration-2 hover:text-pink transition-colors"
                >
                  View inspiration
                </Link>
              )}
            </div>
          ))}
        </div>
      </ColorBand>

      {/* ===== "THE MANUELS" ILLUSTRATION ===== */}
      <section className="py-12 animate-on-scroll text-center">
        <div className="max-w-xs mx-auto">
          <Image
            src="/images/graphics/Untitled - May 22, 2026 at 01.07.53.png"
            alt="The Manuels - couple illustration with heart"
            width={400}
            height={400}
            className="w-full h-auto hover:scale-105 transition-transform duration-500"
          />
        </div>
      </section>

      {/* ===== QUICK LINKS (sage bg) ===== */}
      <ColorBand bg="bg-sage/15" className="py-16 sm:py-20">
        <div className="text-center animate-on-scroll">
          <h2 className="text-2xl font-heading text-deep-sage mb-8">
            While You&apos;re Here
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 stagger-children">
            {[
              { label: "Schedule", href: "/schedule" },
              { label: "Lodging", href: "/lodging" },
              { label: "Things To Do", href: "/things-to-do" },
              { label: "What to Wear", href: "/what-to-wear" },
            ].map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="bounce-on-scroll is-visible rounded-xl border-2 border-dashed border-sage/40 bg-white p-5 text-sm font-medium text-dark transition-all hover:border-pink hover:bg-pink/5 hover:scale-105 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-sage"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </ColorBand>

      {/* ===== FAREWELL ILLUSTRATION ===== */}
      <section className="pt-12 pb-4 animate-on-scroll text-center">
        <div className="max-w-sm mx-auto">
          <Image
            src="/images/graphics/8B4E9D0B-50D5-486B-A6D4-28C817B0A5A8.png"
            alt="Andrew and Kayla driving off in convertible"
            width={600}
            height={400}
            className="w-full h-auto opacity-60 hover:opacity-100 transition-opacity duration-500"
          />
        </div>
      </section>
    </div>
  );
}
