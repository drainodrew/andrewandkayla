"use client";

import { useState, useCallback, useRef } from "react";
import { selectParty } from "@/lib/actions/rsvp";
import { useLanguage, getTranslations } from "@/lib/i18n";

interface PartyResult {
  party_id: string;
  display_name: string;
  party_size: number;
}

export function GuestSearch({
  onPartySelected,
}: {
  onPartySelected: () => void;
}) {
  const { lang } = useLanguage();
  const t = getTranslations(lang);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PartyResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isSelecting, setIsSelecting] = useState(false);
  const [error, setError] = useState("");
  const [hasSearched, setHasSearched] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback(async (q: string) => {
    if (q.length < 3) {
      setResults([]);
      setHasSearched(false);
      return;
    }

    setIsSearching(true);
    setError("");

    try {
      const res = await fetch(
        `/api/guest-lookup?q=${encodeURIComponent(q)}`
      );
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Search failed.");
        setResults([]);
      } else {
        setResults(data.results || []);
      }
      setHasSearched(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsSearching(false);
    }
  }, []);

  // Debounce search on input change. Previous timeout is cancelled on
  // each keystroke so only the final value triggers a request.
  const handleChange = (value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (value.length >= 3) {
      debounceRef.current = setTimeout(() => search(value), 350);
    } else {
      setResults([]);
      setHasSearched(false);
    }
  };

  const handleSelect = async (partyId: string) => {
    setIsSelecting(true);
    const result = await selectParty(partyId);
    if (result.error) {
      setError(result.error);
      setIsSelecting(false);
    } else {
      onPartySelected();
    }
  };

  return (
    <div className="mx-auto max-w-md">
      <label htmlFor="guest-search" className="block text-sm font-medium mb-2">
        {t.rsvp.searchLabel}
      </label>
      <input
        id="guest-search"
        type="text"
        value={query}
        onChange={(e) => handleChange(e.target.value)}
        placeholder={t.rsvp.searchPlaceholder}
        className="w-full rounded-lg border border-sage/50 bg-white px-4 py-3 text-dark placeholder:text-dark/40 focus:outline-none focus:ring-2 focus:ring-pink focus:border-transparent"
        autoComplete="off"
        disabled={isSelecting}
      />

      {query.length > 0 && query.length < 3 && (
        <p className="mt-2 text-sm text-dark/50">
          {t.rsvp.keepTyping}
        </p>
      )}

      {isSearching && (
        <p className="mt-2 text-sm text-dark/50">{t.rsvp.searching}</p>
      )}

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      {results.length > 0 && (
        <ul className="mt-3 space-y-2">
          {results.map((r) => (
            <li key={r.party_id}>
              <button
                type="button"
                onClick={() => handleSelect(r.party_id)}
                disabled={isSelecting}
                className="w-full text-left rounded-lg border border-sage/30 bg-white px-4 py-3 transition-colors hover:border-pink hover:bg-pink/5 focus:outline-none focus:ring-2 focus:ring-pink disabled:opacity-50"
              >
                <span className="font-medium">{r.display_name}</span>
                <span className="ml-2 text-sm text-dark/50">
                  ({t.rsvp.partyOf} {r.party_size})
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {hasSearched && !isSearching && results.length === 0 && !error && (
        <p className="mt-3 text-sm text-dark/60">
          {t.rsvp.noResults}
        </p>
      )}
    </div>
  );
}
