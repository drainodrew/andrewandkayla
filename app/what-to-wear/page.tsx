"use client";

import { useEffect } from "react";
import Image from "next/image";

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
      { threshold: 0.1, rootMargin: "0px 0px -40px 0px" }
    );
    const elements = document.querySelectorAll(
      ".animate-on-scroll, .bounce-on-scroll, .gallery-scroll-reveal"
    );
    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);
}

interface InspoImage {
  src: string;
  alt: string;
  /** Aspect hint for masonry: "tall", "wide", or "square" */
  aspect?: "tall" | "wide" | "square";
}

/**
 * Inspiration photos, shuffled for variety.
 * Seeded shuffle so the order is stable across builds.
 */
const INSPO_IMAGES_UNSHUFFLED: InspoImage[] = [
  { src: "/images/photos/attire/bond.jpg", alt: "Linen suit inspiration", aspect: "square" },
  { src: "/images/photos/attire/IMG_5582.JPG", alt: "Floral dress inspiration", aspect: "tall" },
  { src: "/images/photos/attire/western.jpg", alt: "Western formal inspiration", aspect: "tall" },
  { src: "/images/photos/attire/IMG_5598.JPG", alt: "Garden party champagne toast", aspect: "square" },
  { src: "/images/photos/attire/cigar.jpg", alt: "Linen suit with patterned tie", aspect: "tall" },
  { src: "/images/photos/attire/IMG_5584.JPG", alt: "Floral maxi dress", aspect: "tall" },
  { src: "/images/photos/attire/mj1.jpg", alt: "Style inspiration", aspect: "square" },
  { src: "/images/photos/attire/IMG_5587.JPG", alt: "Garden wedding outfit", aspect: "tall" },
  { src: "/images/photos/attire/scarf-linen.jpg", alt: "Scarf and linen look", aspect: "tall" },
  { src: "/images/photos/attire/IMG_5601.JPG", alt: "Garden table setting", aspect: "tall" },
  { src: "/images/photos/attire/western2.jpg", alt: "Western suit inspiration", aspect: "square" },
  { src: "/images/photos/attire/IMG_5583.JPG", alt: "Dress inspiration", aspect: "tall" },
  { src: "/images/photos/attire/gere.jpg", alt: "Classic suit look", aspect: "square" },
  { src: "/images/photos/attire/IMG_5612.JPG", alt: "Sage green suit with drinks", aspect: "tall" },
  { src: "/images/photos/attire/IMG_5585.JPG", alt: "Outfit inspiration", aspect: "tall" },
  { src: "/images/photos/attire/mj3.jpg", alt: "Golf course style", aspect: "tall" },
  { src: "/images/photos/attire/IMG_5605.JPG", alt: "Elegant dress at garden party", aspect: "tall" },
  { src: "/images/photos/attire/brownwestern.jpg", alt: "Brown western look", aspect: "square" },
  { src: "/images/photos/attire/highxtar-Tyler-The-Creator-GOLF-Le-Fleur5.jpg", alt: "Bold color suit", aspect: "tall" },
  { src: "/images/photos/attire/IMG_5586.JPG", alt: "Dress inspiration", aspect: "tall" },
  { src: "/images/photos/attire/bond2.jpg", alt: "Casual suit look", aspect: "square" },
  { src: "/images/photos/attire/IMG_5599.JPG", alt: "Garden setting", aspect: "tall" },
  { src: "/images/photos/attire/mj2.jpg", alt: "Style icon", aspect: "square" },
  { src: "/images/photos/attire/IMG_5589.JPG", alt: "Outfit inspiration", aspect: "tall" },
  { src: "/images/photos/attire/western3.jpg", alt: "Western style formal", aspect: "tall" },
  { src: "/images/photos/attire/IMG_5603.JPG", alt: "Garden party style", aspect: "tall" },
  { src: "/images/photos/attire/doublep.jpg", alt: "Double breasted suit", aspect: "square" },
  { src: "/images/photos/attire/IMG_5600.JPG", alt: "Outdoor wedding vibe", aspect: "square" },
  { src: "/images/photos/attire/rando.jpg", alt: "Suit inspiration", aspect: "tall" },
  { src: "/images/photos/attire/IMG_5604.JPG", alt: "Garden party look", aspect: "tall" },
  { src: "/images/photos/attire/mj4.jpg", alt: "Style icon moment", aspect: "square" },
  { src: "/images/photos/attire/IMG_5610.JPG", alt: "Wedding guest outfit", aspect: "tall" },
  { src: "/images/photos/attire/timmy.jpg", alt: "Bold suit style", aspect: "tall" },
  { src: "/images/photos/attire/IMG_5590.JPG", alt: "Accessory details", aspect: "square" },
  { src: "/images/photos/attire/IMG_5614.JPG", alt: "Garden attire", aspect: "tall" },
  { src: "/images/photos/attire/jnick.jpg", alt: "Smart casual look", aspect: "square" },
  { src: "/images/photos/attire/miami.jpg", alt: "Relaxed formal", aspect: "square" },
  { src: "/images/photos/attire/IMG_5616.JPG", alt: "Outfit inspiration", aspect: "tall" },
  { src: "/images/photos/attire/IMG_5620.JPG", alt: "Mariachi-inspired formal", aspect: "tall" },
  { src: "/images/photos/attire/oldaiman.jpg", alt: "Dapper look", aspect: "tall" },
  { src: "/images/photos/attire/IMG_5615.JPG", alt: "Garden style", aspect: "tall" },
  { src: "/images/photos/attire/western4.jpg", alt: "Western hat look", aspect: "square" },
  { src: "/images/photos/attire/IMG_5588.WEBP", alt: "Wedding guest style", aspect: "tall" },
  { src: "/images/photos/attire/mj5.jpg", alt: "Style moment", aspect: "square" },
  { src: "/images/photos/attire/IMG_5611.JPG", alt: "Garden formal look", aspect: "tall" },
  { src: "/images/photos/attire/IMG_5602.JPG", alt: "Table setting inspiration", aspect: "tall" },
  { src: "/images/photos/attire/ald.jpg", alt: "Street style formal", aspect: "square" },
  { src: "/images/photos/attire/IMG_5617.JPG", alt: "Garden party guest", aspect: "tall" },
  { src: "/images/photos/attire/IMG_5606.JPG", alt: "Style detail", aspect: "square" },
  { src: "/images/photos/attire/IMG_5607.JPG", alt: "Outfit detail", aspect: "square" },
  { src: "/images/photos/attire/IMG_5608.JPG", alt: "Accessory detail", aspect: "square" },
  { src: "/images/photos/attire/IMG_5613.JPG", alt: "Attire inspiration", aspect: "tall" },
  { src: "/images/photos/attire/IMG_5619.JPG", alt: "Garden outfit", aspect: "tall" },
  { src: "/images/photos/attire/IMG_5624.JPG", alt: "Guest style", aspect: "tall" },
  { src: "/images/photos/attire/IMG_5625.JPG", alt: "Wedding guest look", aspect: "tall" },
  { src: "/images/photos/attire/IMG_5626.JPG", alt: "Garden formal style", aspect: "tall" },
  { src: "/images/photos/attire/IMG_5677.JPG", alt: "Style inspiration", aspect: "tall" },
  { src: "/images/photos/attire/1.jpg", alt: "Formal wear inspiration", aspect: "tall" },
  { src: "/images/photos/attire/IMG_5621.PNG", alt: "Style guide", aspect: "tall" },
  { src: "/images/photos/attire/IMG_5618.JPG", alt: "Accessory", aspect: "square" },
  { src: "/images/photos/attire/IMG_5622.JPG", alt: "Jewelry detail", aspect: "square" },
  { src: "/images/photos/attire/IMG_5594.jpeg", alt: "Garden party outfit", aspect: "tall" },
  { src: "/images/photos/attire/IMG_5631.jpeg", alt: "Style inspiration", aspect: "tall" },
  { src: "/images/photos/attire/IMG_5635.jpeg", alt: "Wedding guest look", aspect: "tall" },
  { src: "/images/photos/attire/IMG_5636.jpeg", alt: "Formal attire", aspect: "tall" },
  { src: "/images/photos/attire/IMG_5637.jpeg", alt: "Outfit inspiration", aspect: "tall" },
  { src: "/images/photos/attire/IMG_5638.jpeg", alt: "Garden formal style", aspect: "tall" },
  { src: "/images/photos/attire/IMG_5641.jpeg", alt: "Dress inspiration", aspect: "tall" },
  { src: "/images/photos/attire/IMG_5645.jpeg", alt: "Elegant look", aspect: "tall" },
  { src: "/images/photos/attire/IMG_5649.jpeg", alt: "Style detail", aspect: "tall" },
  { src: "/images/photos/attire/IMG_5650.jpeg", alt: "Formal outfit", aspect: "tall" },
  { src: "/images/photos/attire/IMG_5661.jpeg", alt: "Wedding attire", aspect: "tall" },
  { src: "/images/photos/attire/IMG_5662.JPG", alt: "Garden party style", aspect: "tall" },
  { src: "/images/photos/attire/IMG_5669.jpeg", alt: "Guest outfit", aspect: "tall" },
  { src: "/images/photos/attire/IMG_5673.jpeg", alt: "Formal inspiration", aspect: "tall" },
  { src: "/images/photos/attire/IMG_5675.JPG", alt: "Style moment", aspect: "tall" },
  { src: "/images/photos/attire/IMG_5679.jpeg", alt: "Attire detail", aspect: "tall" },
  { src: "/images/photos/attire/IMG_5682.JPG", alt: "Garden look", aspect: "tall" },
  { src: "/images/photos/attire/IMG_5691.JPG", alt: "Suit inspiration", aspect: "tall" },
  { src: "/images/photos/attire/IMG_5704.JPG", alt: "Formal style", aspect: "tall" },
  { src: "/images/photos/attire/IMG_5705.jpeg", alt: "Wedding guest outfit", aspect: "tall" },
];

// Seeded shuffle: deterministic order that looks random
function seededShuffle<T>(arr: T[], seed: number): T[] {
  const result = [...arr];
  let s = seed;
  for (let i = result.length - 1; i > 0; i--) {
    s = (s * 16807 + 0) % 2147483647;
    const j = s % (i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

const INSPO_IMAGES = seededShuffle(INSPO_IMAGES_UNSHUFFLED, 8292026);

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

export default function WhatToWearPage() {
  useScrollAnimations();

  return (
    <div className="relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw] w-screen bg-pink/20 min-h-screen">
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8 overflow-hidden">
      {/* Header */}
      <div className="text-center mb-6 animate-on-scroll">
        <h1 className="text-4xl sm:text-6xl font-heading text-deep-sage mb-4">
          Garden Formal
        </h1>
        <p className="text-dark/60 max-w-lg mx-auto leading-relaxed mb-3">
          Think warm summer evening on the lawn of a historic mansion.
          Dress to impress, but keep it comfortable enough to dance.
        </p>
      </div>

      {/* Style tips */}
      <div className="animate-on-scroll max-w-2xl mx-auto mb-12">
        <div className="rounded-3xl border-2 border-dashed border-sage/40 bg-pink/5 p-6 sm:p-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-sm text-dark/70 leading-relaxed">
            <div>
              <Image
                src="/images/graphics/fellas-v2.png"
                alt="Illustrated men in garden formal attire"
                width={800}
                height={500}
                className="w-full h-auto mb-4"
              />
              <h3 className="font-heading text-deep-sage text-base mb-2">For the Fellas</h3>
              <p>
                Linen suits, summer-weight blazers, loafers, cowboy boots, bolo ties,
                pocket squares. Think southern gentleman meets garden party.
                Light colors welcome. No shorts or sneakers.
              </p>
            </div>
            <div>
              <Image
                src="/images/graphics/ladies-v2.png"
                alt="Illustrated women in garden formal attire"
                width={800}
                height={500}
                className="w-full h-auto mb-4"
              />
              <h3 className="font-heading text-deep-sage text-base mb-2">For the Ladies</h3>
              <p>
                Ladies are encouraged to wear floor-length dresses in soft summer
                colors, florals, and romantic textures.
              </p>
            </div>
          </div>
        </div>
      </div>

      <WavyDivider />

      <p className="text-center text-sm text-dark/40 mt-6 mb-10 animate-on-scroll">
        Some inspiration to get you started
      </p>

      {/* Masonry-style gallery */}
      <div className="columns-2 sm:columns-3 gap-3 sm:gap-4 [column-fill:_balance]">
        {INSPO_IMAGES.map((img, i) => (
          <div
            key={img.src}
            className="gallery-scroll-reveal break-inside-avoid mb-3 sm:mb-4"
          >
            <div className="group relative overflow-hidden rounded-2xl bg-cream border-2 border-transparent hover:border-pink/40 transition-all duration-300 hover:shadow-lg">
              <Image
                src={img.src}
                alt={img.alt}
                width={600}
                height={img.aspect === "tall" ? 900 : img.aspect === "wide" ? 400 : 600}
                className="w-full h-auto object-cover transition-transform duration-700 group-hover:scale-105"
                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 33vw"
              />
              {/* Subtle overlay on hover */}
              <div className="absolute inset-0 bg-gradient-to-t from-dark/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
            </div>
          </div>
        ))}
      </div>

      {/* Bottom illustration */}
      <div className="mt-16 text-center animate-on-scroll">
        <div className="max-w-[220px] mx-auto mb-4">
          <Image
            src="/images/graphics/martini-manuels.png"
            alt="Andrew and Kayla sitting in a martini glass"
            width={400}
            height={400}
            className="w-full h-auto mix-blend-multiply opacity-60 hover:opacity-100 transition-opacity duration-500"
          />
        </div>
        <p className="text-sm text-dark/40">
          See you on the lawn.
        </p>
      </div>
    </div>
    </div>
  );
}
