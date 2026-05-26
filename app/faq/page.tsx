"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useLanguage, getTranslations } from "@/lib/i18n";

type FAQItem = {
  question: string;
  answer: ReactNode;
};

type FAQCategory = {
  title: string;
  items: FAQItem[];
};

/**
 * Replaces link placeholders in FAQ answer strings with actual Link components.
 */
function renderFaqAnswer(
  text: string,
  links: Record<string, { href: string; label: string }>
): ReactNode {
  // Check for link placeholders like {whatToWearLink}
  const parts = text.split(/(\{[a-zA-Z]+\})/g);
  if (parts.length === 1) return text;

  return (
    <>
      {parts.map((part, i) => {
        const match = part.match(/^\{([a-zA-Z]+)\}$/);
        if (match && links[match[1]]) {
          const link = links[match[1]];
          return (
            <Link
              key={i}
              href={link.href}
              className="text-deep-sage underline underline-offset-2 hover:text-deep-sage/80"
            >
              {link.label}
            </Link>
          );
        }
        return part;
      })}
    </>
  );
}

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
    <div className="border-b border-deep-sage/20 last:border-b-0">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        className="flex w-full items-center justify-between gap-4 py-5 text-left transition-colors hover:text-deep-sage focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pink"
      >
        <span className="text-lg font-medium text-deep-sage">{item.question}</span>
        <span
          aria-hidden="true"
          className={`shrink-0 text-2xl leading-none transition-transform duration-300 ${
            isOpen ? "rotate-45 text-deep-sage" : "text-deep-sage/50"
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
          <div className="pb-5 text-deep-sage/80 leading-relaxed">{item.answer}</div>
        </div>
      </div>
    </div>
  );
}

export default function FAQPage() {
  const [openItems, setOpenItems] = useState<Set<string>>(new Set());
  const { lang } = useLanguage();
  const t = getTranslations(lang);

  const faqLinks: Record<string, { href: string; label: string }> = {
    whatToWearLink: { href: "/what-to-wear", label: t.faq.whatToWearLinkText },
    rsvpLink: { href: "/rsvp", label: t.faq.rsvpLinkText },
    lodgingLink: { href: "/lodging", label: t.faq.lodgingLinkText },
    thingsToDoLink: { href: "/things-to-do", label: t.faq.thingsToDoLinkText },
  };

  const faqData: FAQCategory[] = t.faq.categories.map((cat) => ({
    title: cat.title,
    items: cat.items.map((item) => ({
      question: item.q,
      answer: renderFaqAnswer(item.a, faqLinks),
    })),
  }));

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
          {t.faq.title}
        </h1>
        <p className="mt-4 text-lg text-dark/60">
          {t.faq.subtitle}
        </p>
      </div>

      <div className="space-y-10">
        {faqData.map((category, catIdx) => (
          <section key={category.title}>
            <h2 className="font-heading mb-4 text-2xl text-deep-sage">
              {category.title}
            </h2>
            <div className="rounded-xl border border-pink/30 bg-pink/15 px-6">
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
          {t.faq.stillHaveQuestions}{" "}
          <span className="text-deep-sage font-medium">
            {t.faq.reachOut}
          </span>{" "}
          {t.faq.happyToHelp}
        </p>
      </div>
    </div>
  );
}
