"use client";

import { useState } from "react";
import Image from "next/image";

interface RegistryItem {
  id: string;
  name: string;
  description: string;
  price: string;
  merchantName: string;
  merchantUrl: string;
  imagePath: string;
  category: string;
}

// Placeholder items until the real registry_items table is populated
const REGISTRY_ITEMS: RegistryItem[] = [
  {
    id: "working-glass",
    name: "Large 21 oz. Working Glass with Lid",
    description:
      "The everyday glass. Great for iced coffee, smoothies, or just water. Comes with a lid for on the go.",
    price: "$13.95",
    merchantName: "Crate & Barrel",
    merchantUrl:
      "https://www.crateandbarrel.com/large-21-oz.-working-glass-with-lid/s485145",
    imagePath: "/images/registry/working-glass.jpg",
    category: "Kitchen",
  },
  {
    id: "atwell-highball",
    name: "Atwell 16 oz. Stackable Ribbed Highball Glass",
    description:
      "Beautiful ribbed texture, stackable for easy storage. Perfect for cocktails or sparkling water.",
    price: "$8.95",
    merchantName: "Crate & Barrel",
    merchantUrl:
      "https://www.crateandbarrel.com/atwell-16-oz.-stackable-ribbed-highball-glass/s202062",
    imagePath: "/images/registry/atwell-highball.jpg",
    category: "Kitchen",
  },
  {
    id: "eight-sleep-pod5",
    name: "Eight Sleep Pod 5",
    description:
      "The smart mattress cover that heats, cools, and tracks your sleep. We are obsessed with ours and would love an upgrade to the Pod 5.",
    price: "$2,849+",
    merchantName: "Eight Sleep",
    merchantUrl: "https://www.eightsleep.com/product/the-cover/",
    imagePath: "/images/registry/eight-sleep-pod5.png",
    category: "Home",
  },
  {
    id: "honeymoon-fund",
    name: "Honeymoon Fund",
    description:
      "Help us make some memories. We're planning a trip after the wedding and any contribution means the world to us.",
    price: "Any amount",
    merchantName: "",
    merchantUrl: "",
    imagePath: "",
    category: "Experiences",
  },
];

function RegistryCard({ item }: { item: RegistryItem }) {
  const [isHovered, setIsHovered] = useState(false);

  const isHoneymoon = item.id === "honeymoon-fund";

  return (
    <div
      className="group relative rounded-2xl border border-sage/20 bg-white overflow-hidden transition-all duration-300 hover:shadow-lg hover:border-pink/40"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Image */}
      <div className="relative aspect-square overflow-hidden bg-cream">
        {item.imagePath ? (
          <Image
            src={item.imagePath}
            alt={item.name}
            fill
            className={`object-cover transition-transform duration-500 ${
              isHovered ? "scale-105" : "scale-100"
            }`}
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-pink/10">
            <svg
              className="w-16 h-16 text-pink/60"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z"
              />
            </svg>
          </div>
        )}
      </div>

      {/* Details */}
      <div className="p-5">
        <div className="mb-3">
          <h3 className="font-medium text-dark text-base leading-snug">
            {item.name}
          </h3>
          {item.merchantName && (
            <p className="text-xs text-dark/40 mt-1">{item.merchantName}</p>
          )}
        </div>

        <p className="text-sm text-dark/60 leading-relaxed mb-4">
          {item.description}
        </p>

        <div className="flex items-center justify-between">
          <span className="text-lg font-medium text-deep-sage">
            {item.price}
          </span>

          {isHoneymoon ? (
            <button
              type="button"
              className="rounded-full bg-pink px-5 py-2 text-sm font-medium text-dark transition-colors hover:bg-pink/80 focus:outline-none focus:ring-2 focus:ring-sage"
            >
              Contribute
            </button>
          ) : (
            <a
              href={item.merchantUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full bg-pink px-5 py-2 text-sm font-medium text-dark transition-colors hover:bg-pink/80 focus:outline-none focus:ring-2 focus:ring-sage"
            >
              View Item
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

export default function RegistryPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="text-center mb-16">
        <h1 className="text-4xl sm:text-5xl font-heading text-deep-sage mb-4">
          Registry
        </h1>
        <p className="text-dark/60 max-w-lg mx-auto leading-relaxed">
          Your presence is the greatest gift. But if you&apos;d like to give us
          something, here are a few things we&apos;d love.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
        {REGISTRY_ITEMS.map((item) => (
          <RegistryCard key={item.id} item={item} />
        ))}
      </div>

      <div className="mt-20 text-center">
        <p className="text-sm text-dark/50">
          Items link to the merchant&apos;s website. After purchasing, come back
          and let us know so we can keep track.
        </p>
      </div>
    </div>
  );
}
