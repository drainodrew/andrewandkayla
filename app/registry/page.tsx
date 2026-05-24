"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  getRegistryItems,
  claimItem,
  confirmPurchase,
  releaseItem,
} from "@/lib/actions/registry";

interface RegistryItem {
  id: string;
  name: string;
  description: string | null;
  price_cents: number | null;
  merchant_name: string | null;
  merchant_url: string | null;
  image_url: string | null;
  status: "available" | "pending" | "purchased";
  sort_order: number | null;
  claimed_by_me: boolean;
}

type SortOption = "default" | "price-low" | "price-high";

function formatPrice(cents: number | null): string {
  if (!cents) return "";
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: cents % 100 === 0 ? 0 : 2 })}`;
}

function ConfirmModal({
  itemName,
  onConfirm,
  onCancel,
  isLoading,
}: {
  itemName: string;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-dark/40 backdrop-blur-sm"
        onClick={onCancel}
      />
      <div className="relative bg-white rounded-2xl p-8 max-w-md w-full shadow-xl">
        <h3 className="text-xl font-heading text-deep-sage mb-3">
          Did you buy it?
        </h3>
        <p className="text-sm text-dark/70 mb-6">
          Did you purchase the <strong>{itemName}</strong>? This helps us avoid
          duplicate gifts.
        </p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className="flex-1 rounded-lg bg-pink px-5 py-3 text-sm font-medium text-dark transition-colors hover:bg-pink/80 disabled:opacity-50"
          >
            {isLoading ? "Saving..." : "Yes, I bought it!"}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="flex-1 rounded-lg border border-sage/40 px-5 py-3 text-sm font-medium text-dark/70 transition-colors hover:bg-sage/10 disabled:opacity-50"
          >
            No, not yet
          </button>
        </div>
      </div>
    </div>
  );
}

function NeedRsvpModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-dark/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative bg-white rounded-2xl p-8 max-w-md w-full shadow-xl text-center">
        <h3 className="text-xl font-heading text-deep-sage mb-3">
          RSVP First!
        </h3>
        <p className="text-sm text-dark/70 mb-6">
          We need to know who you are before you can claim a gift. RSVP real
          quick and then come back here.
        </p>
        <div className="flex gap-3">
          <Link
            href="/rsvp"
            className="flex-1 rounded-lg bg-pink px-5 py-3 text-sm font-medium text-dark text-center transition-colors hover:bg-pink/80"
          >
            Go to RSVP
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-lg border border-sage/40 px-5 py-3 text-sm font-medium text-dark/70 transition-colors hover:bg-sage/10"
          >
            Maybe later
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Honeymoon fund is special: it's never "purchased" or "pending",
 * it allows unlimited contributions.
 */
function isHoneymoonFund(item: RegistryItem): boolean {
  return item.price_cents === 0 && !item.merchant_url;
}

function RegistryCard({
  item,
  onClaim,
  onReturn,
}: {
  item: RegistryItem;
  onClaim: (id: string, merchantUrl: string | null) => void;
  onReturn: (id: string) => void;
}) {
  const [isHovered, setIsHovered] = useState(false);
  const honeymoon = isHoneymoonFund(item);
  const isPurchased = item.status === "purchased" && !honeymoon;
  const isPendingByMe = item.status === "pending" && item.claimed_by_me && !honeymoon;
  const isPendingByOther =
    item.status === "pending" && !item.claimed_by_me && !honeymoon;

  return (
    <div
      className={`group relative rounded-2xl border bg-white overflow-hidden transition-all duration-300 ${
        isPurchased
          ? "border-sage/20 opacity-60"
          : "border-sage/20 hover:shadow-lg hover:border-pink/40"
      }`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {isPurchased && (
        <div className="absolute top-4 right-4 z-10 rounded-full bg-sage/80 px-3 py-1 text-xs font-medium text-white">
          Purchased
        </div>
      )}

      <div className="relative aspect-square overflow-hidden bg-cream">
        {item.image_url ? (
          <Image
            src={item.image_url}
            alt={item.name}
            fill
            className={`object-cover transition-transform duration-500 ${
              isHovered && !isPurchased ? "scale-105" : "scale-100"
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

      <div className="p-5">
        <div className="mb-3">
          <h3 className="font-medium text-dark text-base leading-snug">
            {item.name}
          </h3>
          {item.merchant_name && (
            <p className="text-xs text-dark/40 mt-1">{item.merchant_name}</p>
          )}
        </div>

        {item.description && (
          <p className="text-sm text-dark/60 leading-relaxed mb-4">
            {item.description}
          </p>
        )}

        <div className="flex items-center justify-between gap-3">
          {!honeymoon && (
            <span className="text-lg font-medium text-deep-sage">
              {formatPrice(item.price_cents)}
            </span>
          )}

          {honeymoon ? (
            <a
              href="https://venmo.com/drainodrew"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full block text-center rounded-full bg-pink px-5 py-2.5 text-sm font-medium text-dark transition-colors hover:bg-pink/80 active:bg-pink/70 focus:outline-none focus:ring-2 focus:ring-sage"
            >
              Contribute
            </a>
          ) : isPurchased ? (
            <span className="text-sm text-dark/40">Thank you!</span>
          ) : isPendingByMe ? (
            <button
              type="button"
              onClick={() => onReturn(item.id)}
              className="rounded-full border border-sage/40 px-5 py-2.5 text-sm font-medium text-dark/70 transition-colors hover:bg-sage/10 active:bg-sage/20"
            >
              I changed my mind
            </button>
          ) : isPendingByOther ? (
            <span className="text-sm text-dark/40 italic">
              Someone&apos;s on it
            </span>
          ) : (
            <button
              type="button"
              onClick={() => onClaim(item.id, item.merchant_url)}
              className="rounded-full bg-pink px-5 py-2.5 text-sm font-medium text-dark transition-colors hover:bg-pink/80 active:bg-pink/70 focus:outline-none focus:ring-2 focus:ring-sage"
            >
              I want to buy this
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function RegistryPage() {
  const [items, setItems] = useState<RegistryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("default");
  const [confirmingItem, setConfirmingItem] = useState<RegistryItem | null>(
    null
  );
  const [showRsvpModal, setShowRsvpModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const loadItems = useCallback(async () => {
    const result = await getRegistryItems();
    if (result.error) {
      setError(result.error);
    } else {
      setItems(result.items as RegistryItem[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  const handleClaim = async (itemId: string, merchantUrl: string | null) => {
    // Open merchant URL FIRST (synchronously from user gesture)
    // so mobile browsers don't block the popup
    if (merchantUrl) {
      window.open(merchantUrl, "_blank");
    }

    setActionLoading(true);
    const result = await claimItem(itemId);

    if (result.error) {
      if (result.error.includes("RSVP")) {
        setShowRsvpModal(true);
      } else {
        setError(result.error);
      }
      setActionLoading(false);
      return;
    }

    // Reload and show confirmation modal
    await loadItems();
    const item = items.find((i) => i.id === itemId);
    if (item && !isHoneymoonFund(item)) {
      setConfirmingItem(item);
    }
    setActionLoading(false);
  };

  const handleConfirmPurchase = async () => {
    if (!confirmingItem) return;
    setActionLoading(true);

    const result = await confirmPurchase(confirmingItem.id);
    if (result.error) {
      setError(result.error);
    }

    setConfirmingItem(null);
    setActionLoading(false);
    await loadItems();
  };

  const handleCancelClaim = async () => {
    if (!confirmingItem) return;
    setActionLoading(true);

    await releaseItem(confirmingItem.id);
    setConfirmingItem(null);
    setActionLoading(false);
    await loadItems();
  };

  const handleReturn = async (itemId: string) => {
    setActionLoading(true);
    await releaseItem(itemId);
    setActionLoading(false);
    await loadItems();
  };

  const sortedItems = [...items].sort((a, b) => {
    // Honeymoon fund always last (but above purchased)
    const aHoneymoon = isHoneymoonFund(a);
    const bHoneymoon = isHoneymoonFund(b);

    // Purchased items sink to bottom
    const aPurchased = a.status === "purchased" && !aHoneymoon;
    const bPurchased = b.status === "purchased" && !bHoneymoon;
    if (aPurchased && !bPurchased) return 1;
    if (!aPurchased && bPurchased) return -1;

    if (sortBy === "price-low") {
      return (a.price_cents || 0) - (b.price_cents || 0);
    }
    if (sortBy === "price-high") {
      return (b.price_cents || 0) - (a.price_cents || 0);
    }

    return (a.sort_order || 0) - (b.sort_order || 0);
  });

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-16 text-center">
        <p className="text-dark/50">Loading registry...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="text-center mb-12">
        <h1 className="text-4xl sm:text-5xl font-heading text-deep-sage mb-4">
          Registry
        </h1>
        <p className="text-dark/60 max-w-lg mx-auto leading-relaxed">
          Your presence is the greatest gift. But if you&apos;d like to give us
          something, here are a few things we&apos;d love.
        </p>
      </div>

      {items.length > 0 && (
        <div className="flex justify-end mb-6">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            className="rounded-lg border border-sage/40 bg-white px-3 py-2 text-sm text-dark/70 focus:outline-none focus:ring-2 focus:ring-pink"
          >
            <option value="default">Sort by: Featured</option>
            <option value="price-low">Price: Low to High</option>
            <option value="price-high">Price: High to Low</option>
          </select>
        </div>
      )}

      {error && (
        <div className="mb-6 rounded-lg bg-pink/10 border border-pink/30 p-4 text-center">
          <p className="text-sm text-dark/80">{error}</p>
          <button
            type="button"
            onClick={() => setError("")}
            className="mt-1 text-xs text-dark/50 underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {items.length === 0 ? (
        <p className="text-center text-dark/60 py-12">
          Registry items coming soon. Check back!
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
          {sortedItems.map((item) => (
            <RegistryCard
              key={item.id}
              item={item}
              onClaim={handleClaim}
              onReturn={handleReturn}
            />
          ))}
        </div>
      )}

      <div className="mt-20 text-center">
        <p className="text-sm text-dark/50">
          Click &quot;I want to buy this&quot; to let us know, then purchase on
          the merchant&apos;s site. When you come back, we&apos;ll ask if you
          bought it so we can keep track.
        </p>
      </div>

      {confirmingItem && (
        <ConfirmModal
          itemName={confirmingItem.name}
          onConfirm={handleConfirmPurchase}
          onCancel={handleCancelClaim}
          isLoading={actionLoading}
        />
      )}

      {showRsvpModal && (
        <NeedRsvpModal onClose={() => setShowRsvpModal(false)} />
      )}
    </div>
  );
}
