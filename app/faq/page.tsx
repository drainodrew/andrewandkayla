"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";

type FAQItem = {
  question: string;
  answer: ReactNode;
};

type FAQCategory = {
  title: string;
  items: FAQItem[];
};

const faqData: FAQCategory[] = [
  {
    title: "The Big Day",
    items: [
      {
        question: "When is the wedding?",
        answer:
          "Saturday, August 29, 2026! The ceremony begins at 5:00 PM. We can't wait to celebrate with you.",
      },
      {
        question: "Where is the wedding?",
        answer:
          "Belle Meade Mansion in Nashville, Tennessee. The address is 110 Leake Ave, Nashville, TN 37205. It's a gorgeous historic estate and we're so excited to share it with you.",
      },
      {
        question: "What is the dress code?",
        answer:
          "Summer Formal. For the guys, think linen suits, loafers or cowboy boots, and a tie, bow tie, or bolo tie. For the ladies, cocktail dresses or anything that makes you feel amazing. Nashville in late August is warm, so lightweight fabrics are your friend.",
      },
      {
        question: "Will the ceremony and reception be at the same location?",
        answer:
          "Yes! Both the ceremony and reception will be held at Belle Meade Mansion, so no need to worry about getting between venues.",
      },
    ],
  },
  {
    title: "RSVP",
    items: [
      {
        question: "How do I RSVP?",
        answer: (
          <>
            Right here on this website! Head over to the{" "}
            <Link
              href="/rsvp"
              className="text-deep-sage underline underline-offset-2 hover:text-deep-sage/80"
            >
              RSVP page
            </Link>
            , search for your name, and let us know if you can make it. No
            stamps required.
          </>
        ),
      },
      {
        question: "Can I bring a date?",
        answer:
          "Our venue has very specific size constraints. Please do not bring additional guests outside of those listed on your invitation / RSVP form.",
      },
      {
        question: "When is the RSVP deadline?",
        answer:
          "Please RSVP by June 1, 2026. We need final headcounts for catering and seating, so the sooner the better!",
      },
      {
        question: "I'm having trouble with the RSVP. What do I do?",
        answer:
          "No worries! Just reach out to Andrew or Kayla directly and we'll help you out. Technology is great until it isn't.",
      },
    ],
  },
  {
    title: "Travel & Lodging",
    items: [
      {
        question: "Where should I stay?",
        answer: (
          <>
            Check out our{" "}
            <Link
              href="/lodging"
              className="text-deep-sage underline underline-offset-2 hover:text-deep-sage/80"
            >
              Lodging page
            </Link>{" "}
            for recommendations. We don&apos;t have an official hotel block, but
            we&apos;ve put together a list of great options near the venue.
          </>
        ),
      },
      {
        question: "What's the closest airport?",
        answer:
          "Nashville International Airport (BNA). It's about 20 minutes from the venue, depending on traffic. Plenty of rideshare options and rental cars are available at the airport.",
      },
      {
        question: "Is there parking at the venue?",
        answer:
          "Yes! Belle Meade has parking available on site. No need to worry about finding a spot.",
      },
      {
        question: "What is there to do in Nashville?",
        answer: (
          <>
            So much! Nashville is an incredible city. Check out our{" "}
            <Link
              href="/things-to-do"
              className="text-deep-sage underline underline-offset-2 hover:text-deep-sage/80"
            >
              Things To Do page
            </Link>{" "}
            for our favorite spots, from honky tonks to hot chicken.
          </>
        ),
      },
    ],
  },
  {
    title: "Day Of",
    items: [
      {
        question: "What time should I arrive?",
        answer:
          "The ceremony starts at 5:00 PM, so please arrive by 4:30 PM to get settled. We'll start on time!",
      },
      {
        question: "Will there be food and drinks?",
        answer:
          "Absolutely. Dinner and an open bar will be waiting for you at the reception. Come hungry and thirsty.",
      },
      {
        question: "Can I take photos during the ceremony?",
        answer:
          "We'll have a wonderful photographer capturing everything, so we ask that you keep phones away during the ceremony. But at the reception? Go wild. We love a good candid.",
      },
    ],
  },
];

/**
 * Single accordion item. Uses CSS grid for smooth height animation
 * without needing to measure the content DOM node. The grid row
 * transitions from 0fr (collapsed) to 1fr (expanded).
 */
function AccordionItem({
  item,
  isOpen,
  onToggle,
}: {
  item: FAQItem;
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="border-b border-sage/40 last:border-b-0">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        className="flex w-full items-center justify-between gap-4 py-5 text-left transition-colors hover:text-deep-sage focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pink"
      >
        <span className="text-lg font-medium text-dark">{item.question}</span>
        <span
          aria-hidden="true"
          className={`shrink-0 text-2xl leading-none transition-transform duration-300 ${
            isOpen ? "rotate-45 text-pink" : "text-sage"
          }`}
        >
          +
        </span>
      </button>
      <div
        className="grid transition-[grid-template-rows] duration-300 ease-in-out"
        style={{
          gridTemplateRows: isOpen ? "1fr" : "0fr",
        }}
      >
        <div className="overflow-hidden min-h-0">
          <div className="pb-5 text-dark/80 leading-relaxed">{item.answer}</div>
        </div>
      </div>
    </div>
  );
}

export default function FAQPage() {
  const [openItems, setOpenItems] = useState<Set<string>>(new Set());

  function toggleItem(key: string) {
    setOpenItems((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="mb-12 text-center">
        <h1 className="font-heading text-4xl text-deep-sage sm:text-5xl">
          Questions? We&apos;ve Got Answers.
        </h1>
        <p className="mt-4 text-lg text-dark/60">
          If you don&apos;t find what you&apos;re looking for, reach out to
          Andrew or Kayla anytime.
        </p>
      </div>

      <div className="space-y-10">
        {faqData.map((category, catIdx) => (
          <section key={category.title}>
            <h2 className="font-heading mb-4 text-2xl text-deep-sage">
              {category.title}
            </h2>
            <div className="rounded-xl border border-sage/30 bg-white/50 px-6">
              {category.items.map((item, itemIdx) => {
                const key = `${catIdx}-${itemIdx}`;
                return (
                  <AccordionItem
                    key={key}
                    item={item}
                    isOpen={openItems.has(key)}
                    onToggle={() => toggleItem(key)}
                  />
                );
              })}
            </div>
          </section>
        ))}
      </div>

      <div className="mt-16 text-center">
        <p className="text-dark/60">
          Still have questions?{" "}
          <span className="text-deep-sage font-medium">
            Reach out to Andrew or Kayla directly.
          </span>{" "}
          We&apos;re happy to help!
        </p>
      </div>
    </div>
  );
}
