"use client";

import { useState, useEffect, useTransition } from "react";
import {
  addParty,
  addGuestToParty,
  separateGuestToNewParty,
  listParties,
  listGuestsInParty,
  listEvents,
  getPartyEvents,
  addPartyEvent,
  removePartyEvent,
  deleteGuest,
  deleteParty,
} from "@/lib/actions/add-guest";

type Mode = "new-party" | "add-to-existing" | "separate" | "manage-events" | "delete";

interface GuestRow {
  first_name: string;
  last_name: string;
}

interface PartyOption {
  id: string;
  invite_name: string;
  party_size: number;
}

interface GuestOption {
  id: string;
  first_name: string;
  last_name: string;
}

interface EventOption {
  id: string;
  name: string;
  slug: string;
}

export default function AddGuestPage() {
  const [mode, setMode] = useState<Mode>("new-party");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isPending, startTransition] = useTransition();

  // Shared: party list for "add to existing" and "separate"
  const [parties, setParties] = useState<PartyOption[]>([]);
  const [partiesLoaded, setPartiesLoaded] = useState(false);

  useEffect(() => {
    if ((mode === "add-to-existing" || mode === "separate" || mode === "manage-events" || mode === "delete") && !partiesLoaded) {
      listParties().then((res) => {
        setParties(res.parties);
        setPartiesLoaded(true);
      });
    }
  }, [mode, partiesLoaded]);

  function switchMode(m: Mode) {
    setMode(m);
    setError("");
    setSuccess("");
  }

  return (
    <div className="max-w-2xl">
      <h1 className="font-heading text-3xl text-deep-sage mb-6">Add Guest</h1>

      {/* Mode tabs */}
      <div className="flex gap-1 mb-8 bg-sage/10 rounded-lg p-1">
        {[
          { key: "new-party" as Mode, label: "New Party" },
          { key: "add-to-existing" as Mode, label: "Add to Existing" },
          { key: "separate" as Mode, label: "Separate Guest" },
          { key: "manage-events" as Mode, label: "Manage Events" },
          { key: "delete" as Mode, label: "Remove" },
        ].map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => switchMode(tab.key)}
            className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
              mode === tab.key
                ? "bg-white text-deep-sage shadow-sm"
                : "text-dark/50 hover:text-dark/70"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Feedback */}
      {error && (
        <p className="text-sm text-red-600 bg-red-50 px-4 py-3 rounded-lg mb-6">
          {error}
        </p>
      )}
      {success && (
        <p className="text-sm text-green-700 bg-green-50 px-4 py-3 rounded-lg mb-6">
          {success}
        </p>
      )}

      {mode === "new-party" && (
        <NewPartyForm
          isPending={isPending}
          startTransition={startTransition}
          setError={setError}
          setSuccess={setSuccess}
        />
      )}

      {mode === "add-to-existing" && (
        <AddToExistingForm
          parties={parties}
          isPending={isPending}
          startTransition={startTransition}
          setError={setError}
          setSuccess={setSuccess}
          reloadParties={() => setPartiesLoaded(false)}
        />
      )}

      {mode === "separate" && (
        <SeparateGuestForm
          parties={parties}
          isPending={isPending}
          startTransition={startTransition}
          setError={setError}
          setSuccess={setSuccess}
          reloadParties={() => setPartiesLoaded(false)}
        />
      )}

      {mode === "manage-events" && (
        <ManageEventsForm
          parties={parties}
          isPending={isPending}
          startTransition={startTransition}
          setError={setError}
          setSuccess={setSuccess}
        />
      )}

      {mode === "delete" && (
        <DeleteForm
          parties={parties}
          isPending={isPending}
          startTransition={startTransition}
          setError={setError}
          setSuccess={setSuccess}
          reloadParties={() => setPartiesLoaded(false)}
        />
      )}
    </div>
  );
}

// ─── New Party Form ──────────────────────────────────────────

function NewPartyForm({
  isPending,
  startTransition,
  setError,
  setSuccess,
}: {
  isPending: boolean;
  startTransition: (fn: () => Promise<void>) => void;
  setError: (s: string) => void;
  setSuccess: (s: string) => void;
}) {
  const [inviteName, setInviteName] = useState("");
  const [guests, setGuests] = useState<GuestRow[]>([
    { first_name: "", last_name: "" },
  ]);
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [addressLine1, setAddressLine1] = useState("");
  const [addressLine2, setAddressLine2] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zipCode, setZipCode] = useState("");
  const [notes, setNotes] = useState("");

  function addGuestRow() {
    setGuests((prev) => [...prev, { first_name: "", last_name: "" }]);
  }

  function removeGuestRow(index: number) {
    if (guests.length <= 1) return;
    setGuests((prev) => prev.filter((_, i) => i !== index));
  }

  function updateGuest(index: number, field: keyof GuestRow, value: string) {
    setGuests((prev) =>
      prev.map((g, i) => (i === index ? { ...g, [field]: value } : g))
    );
  }

  function generateInviteName(): string {
    const named = guests.filter(
      (g) => g.first_name.trim() && g.last_name.trim()
    );
    if (named.length === 0) return "";
    if (named.length === 1)
      return `${named[0].first_name} ${named[0].last_name}`;
    const sameLast = named.every((g) => g.last_name === named[0].last_name);
    if (sameLast && named.length === 2) {
      return `${named[0].first_name} & ${named[1].first_name} ${named[0].last_name}`;
    }
    if (named.length === 2) {
      return `${named[0].first_name} ${named[0].last_name} & ${named[1].first_name} ${named[1].last_name}`;
    }
    if (sameLast) return `The ${named[0].last_name} Family`;
    return `${named[0].first_name} ${named[0].last_name} & ${named[1].first_name} ${named[1].last_name}`;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");

    const finalInviteName = inviteName.trim() || generateInviteName();
    if (!finalInviteName) {
      setError("Please add at least one guest with a first and last name.");
      return;
    }

    startTransition(async () => {
      const result = await addParty({
        invite_name: finalInviteName,
        guests,
        email: email || undefined,
        phone: phone || undefined,
        address_line_1: addressLine1 || undefined,
        address_line_2: addressLine2 || undefined,
        city: city || undefined,
        state: state || undefined,
        zip_code: zipCode || undefined,
        notes: notes || undefined,
      });

      if (result.error) {
        setError(result.error);
      } else {
        setSuccess(
          `Added "${result.partyName}" (${guests.length} guest${guests.length > 1 ? "s" : ""}).`
        );
        setInviteName("");
        setGuests([{ first_name: "", last_name: "" }]);
        setEmail("");
        setPhone("");
        setAddressLine1("");
        setAddressLine2("");
        setCity("");
        setState("");
        setZipCode("");
        setNotes("");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Guests */}
      <div className="bg-white rounded-xl border border-sage/30 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-heading text-lg text-deep-sage">Guests</h2>
          <button
            type="button"
            onClick={addGuestRow}
            className="text-sm font-medium text-deep-sage hover:text-pink transition-colors"
          >
            + Add another
          </button>
        </div>
        <div className="space-y-3">
          {guests.map((guest, i) => (
            <div key={i} className="flex gap-3 items-start">
              <input
                type="text"
                placeholder="First name *"
                value={guest.first_name}
                onChange={(e) => updateGuest(i, "first_name", e.target.value)}
                required
                className="flex-1 px-3 py-2 rounded-lg border border-sage/50 bg-white text-dark text-sm placeholder:text-dark/40 focus:outline-none focus:ring-2 focus:ring-pink focus:border-pink transition-colors"
              />
              <input
                type="text"
                placeholder="Last name *"
                value={guest.last_name}
                onChange={(e) => updateGuest(i, "last_name", e.target.value)}
                required
                className="flex-1 px-3 py-2 rounded-lg border border-sage/50 bg-white text-dark text-sm placeholder:text-dark/40 focus:outline-none focus:ring-2 focus:ring-pink focus:border-pink transition-colors"
              />
              {guests.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeGuestRow(i)}
                  className="mt-1.5 text-dark/30 hover:text-red-500 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Party name */}
      <div className="bg-white rounded-xl border border-sage/30 p-6">
        <h2 className="font-heading text-lg text-deep-sage mb-3">Party Name</h2>
        <input
          type="text"
          value={inviteName}
          onChange={(e) => setInviteName(e.target.value)}
          placeholder={generateInviteName() || "e.g. John & Jane Doe"}
          className="w-full px-3 py-2 rounded-lg border border-sage/50 bg-white text-dark text-sm placeholder:text-dark/40 focus:outline-none focus:ring-2 focus:ring-pink focus:border-pink transition-colors"
        />
        <p className="text-xs text-dark/40 mt-2">
          Leave blank to auto-generate from guest names.
        </p>
      </div>

      {/* Contact info */}
      <div className="bg-white rounded-xl border border-sage/30 p-6">
        <h2 className="font-heading text-lg text-deep-sage mb-3">
          Contact Info
          <span className="text-sm font-normal text-dark/40 ml-2">(optional)</span>
        </h2>
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} className="px-3 py-2 rounded-lg border border-sage/50 bg-white text-dark text-sm placeholder:text-dark/40 focus:outline-none focus:ring-2 focus:ring-pink focus:border-pink transition-colors" />
            <input type="tel" placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} className="px-3 py-2 rounded-lg border border-sage/50 bg-white text-dark text-sm placeholder:text-dark/40 focus:outline-none focus:ring-2 focus:ring-pink focus:border-pink transition-colors" />
          </div>
          <input type="text" placeholder="Address line 1" value={addressLine1} onChange={(e) => setAddressLine1(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-sage/50 bg-white text-dark text-sm placeholder:text-dark/40 focus:outline-none focus:ring-2 focus:ring-pink focus:border-pink transition-colors" />
          <input type="text" placeholder="Address line 2" value={addressLine2} onChange={(e) => setAddressLine2(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-sage/50 bg-white text-dark text-sm placeholder:text-dark/40 focus:outline-none focus:ring-2 focus:ring-pink focus:border-pink transition-colors" />
          <div className="grid grid-cols-3 gap-3">
            <input type="text" placeholder="City" value={city} onChange={(e) => setCity(e.target.value)} className="px-3 py-2 rounded-lg border border-sage/50 bg-white text-dark text-sm placeholder:text-dark/40 focus:outline-none focus:ring-2 focus:ring-pink focus:border-pink transition-colors" />
            <input type="text" placeholder="State" value={state} onChange={(e) => setState(e.target.value)} className="px-3 py-2 rounded-lg border border-sage/50 bg-white text-dark text-sm placeholder:text-dark/40 focus:outline-none focus:ring-2 focus:ring-pink focus:border-pink transition-colors" />
            <input type="text" placeholder="ZIP" value={zipCode} onChange={(e) => setZipCode(e.target.value)} className="px-3 py-2 rounded-lg border border-sage/50 bg-white text-dark text-sm placeholder:text-dark/40 focus:outline-none focus:ring-2 focus:ring-pink focus:border-pink transition-colors" />
          </div>
        </div>
      </div>

      {/* Notes */}
      <div className="bg-white rounded-xl border border-sage/30 p-6">
        <h2 className="font-heading text-lg text-deep-sage mb-3">
          Notes <span className="text-sm font-normal text-dark/40 ml-2">(optional)</span>
        </h2>
        <textarea placeholder="Internal notes..." value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="w-full px-3 py-2 rounded-lg border border-sage/50 bg-white text-dark text-sm placeholder:text-dark/40 focus:outline-none focus:ring-2 focus:ring-pink focus:border-pink transition-colors resize-none" />
      </div>

      <button type="submit" disabled={isPending} className="w-full px-6 py-3 rounded-lg bg-pink text-dark font-medium hover:bg-pink/80 focus:outline-none focus:ring-2 focus:ring-pink focus:ring-offset-2 focus:ring-offset-cream transition-colors disabled:opacity-50">
        {isPending ? "Adding..." : "Add Party"}
      </button>
    </form>
  );
}

// ─── Add to Existing Party Form ──────────────────────────────

function AddToExistingForm({
  parties,
  isPending,
  startTransition,
  setError,
  setSuccess,
  reloadParties,
}: {
  parties: PartyOption[];
  isPending: boolean;
  startTransition: (fn: () => Promise<void>) => void;
  setError: (s: string) => void;
  setSuccess: (s: string) => void;
  reloadParties: () => void;
}) {
  const [selectedPartyId, setSelectedPartyId] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [partySearch, setPartySearch] = useState("");

  const filteredParties = partySearch.trim()
    ? parties.filter((p) =>
        p.invite_name.toLowerCase().includes(partySearch.toLowerCase())
      )
    : parties;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!selectedPartyId) {
      setError("Please select a party.");
      return;
    }

    startTransition(async () => {
      const result = await addGuestToParty(selectedPartyId, {
        first_name: firstName,
        last_name: lastName,
      });

      if (result.error) {
        setError(result.error);
      } else {
        const party = parties.find((p) => p.id === selectedPartyId);
        setSuccess(
          `Added ${firstName} ${lastName} to "${party?.invite_name}".`
        );
        setFirstName("");
        setLastName("");
        reloadParties();
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="bg-white rounded-xl border border-sage/30 p-6">
        <h2 className="font-heading text-lg text-deep-sage mb-3">
          Select Party
        </h2>
        <input
          type="text"
          placeholder="Search parties..."
          value={partySearch}
          onChange={(e) => setPartySearch(e.target.value)}
          className="w-full px-3 py-2 rounded-lg border border-sage/50 bg-white text-dark text-sm placeholder:text-dark/40 focus:outline-none focus:ring-2 focus:ring-pink focus:border-pink transition-colors mb-3"
        />
        <select
          value={selectedPartyId}
          onChange={(e) => setSelectedPartyId(e.target.value)}
          className="w-full px-3 py-2 rounded-lg border border-sage/50 bg-white text-dark text-sm focus:outline-none focus:ring-2 focus:ring-pink focus:border-pink transition-colors"
          size={Math.min(8, filteredParties.length + 1)}
        >
          <option value="">Choose a party...</option>
          {filteredParties.map((p) => (
            <option key={p.id} value={p.id}>
              {p.invite_name} ({p.party_size})
            </option>
          ))}
        </select>
      </div>

      <div className="bg-white rounded-xl border border-sage/30 p-6">
        <h2 className="font-heading text-lg text-deep-sage mb-3">New Guest</h2>
        <div className="flex gap-3">
          <input
            type="text"
            placeholder="First name *"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            required
            className="flex-1 px-3 py-2 rounded-lg border border-sage/50 bg-white text-dark text-sm placeholder:text-dark/40 focus:outline-none focus:ring-2 focus:ring-pink focus:border-pink transition-colors"
          />
          <input
            type="text"
            placeholder="Last name *"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            required
            className="flex-1 px-3 py-2 rounded-lg border border-sage/50 bg-white text-dark text-sm placeholder:text-dark/40 focus:outline-none focus:ring-2 focus:ring-pink focus:border-pink transition-colors"
          />
        </div>
      </div>

      <button type="submit" disabled={isPending || !selectedPartyId} className="w-full px-6 py-3 rounded-lg bg-pink text-dark font-medium hover:bg-pink/80 focus:outline-none focus:ring-2 focus:ring-pink focus:ring-offset-2 focus:ring-offset-cream transition-colors disabled:opacity-50">
        {isPending ? "Adding..." : "Add Guest to Party"}
      </button>
    </form>
  );
}

// ─── Separate Guest Form ─────────────────────────────────────

function SeparateGuestForm({
  parties,
  isPending,
  startTransition,
  setError,
  setSuccess,
  reloadParties,
}: {
  parties: PartyOption[];
  isPending: boolean;
  startTransition: (fn: () => Promise<void>) => void;
  setError: (s: string) => void;
  setSuccess: (s: string) => void;
  reloadParties: () => void;
}) {
  const [selectedPartyId, setSelectedPartyId] = useState("");
  const [partyGuests, setPartyGuests] = useState<GuestOption[]>([]);
  const [selectedGuestId, setSelectedGuestId] = useState("");
  const [newPartyName, setNewPartyName] = useState("");
  const [partySearch, setPartySearch] = useState("");

  const filteredParties = partySearch.trim()
    ? parties.filter((p) =>
        p.invite_name.toLowerCase().includes(partySearch.toLowerCase())
      )
    : parties;

  // Only show parties with 2+ guests (can't separate from a party of 1)
  const separableParties = filteredParties.filter((p) => p.party_size >= 2);

  useEffect(() => {
    if (selectedPartyId) {
      listGuestsInParty(selectedPartyId).then((res) => {
        setPartyGuests(res.guests);
        setSelectedGuestId("");
      });
    } else {
      setPartyGuests([]);
    }
  }, [selectedPartyId]);

  // Auto-generate new party name from selected guest
  useEffect(() => {
    const guest = partyGuests.find((g) => g.id === selectedGuestId);
    if (guest) {
      setNewPartyName(`${guest.first_name} ${guest.last_name}`);
    }
  }, [selectedGuestId, partyGuests]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!selectedGuestId || !newPartyName.trim()) {
      setError("Please select a guest and provide a new party name.");
      return;
    }

    startTransition(async () => {
      const result = await separateGuestToNewParty(
        selectedGuestId,
        newPartyName
      );

      if (result.error) {
        setError(result.error);
      } else {
        setSuccess(
          `Moved ${result.guestName} to new party "${result.newPartyName}".`
        );
        setSelectedPartyId("");
        setSelectedGuestId("");
        setNewPartyName("");
        reloadParties();
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="bg-white rounded-xl border border-sage/30 p-6">
        <h2 className="font-heading text-lg text-deep-sage mb-3">
          Select Party
        </h2>
        <input
          type="text"
          placeholder="Search parties..."
          value={partySearch}
          onChange={(e) => setPartySearch(e.target.value)}
          className="w-full px-3 py-2 rounded-lg border border-sage/50 bg-white text-dark text-sm placeholder:text-dark/40 focus:outline-none focus:ring-2 focus:ring-pink focus:border-pink transition-colors mb-3"
        />
        <select
          value={selectedPartyId}
          onChange={(e) => setSelectedPartyId(e.target.value)}
          className="w-full px-3 py-2 rounded-lg border border-sage/50 bg-white text-dark text-sm focus:outline-none focus:ring-2 focus:ring-pink focus:border-pink transition-colors"
          size={Math.min(8, separableParties.length + 1)}
        >
          <option value="">Choose a party...</option>
          {separableParties.map((p) => (
            <option key={p.id} value={p.id}>
              {p.invite_name} ({p.party_size})
            </option>
          ))}
        </select>
      </div>

      {partyGuests.length > 0 && (
        <div className="bg-white rounded-xl border border-sage/30 p-6">
          <h2 className="font-heading text-lg text-deep-sage mb-3">
            Select Guest to Separate
          </h2>
          <div className="space-y-2">
            {partyGuests.map((guest) => (
              <label
                key={guest.id}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg border cursor-pointer transition-colors ${
                  selectedGuestId === guest.id
                    ? "border-pink bg-pink/5"
                    : "border-sage/30 hover:border-pink/50"
                }`}
              >
                <input
                  type="radio"
                  name="guest"
                  value={guest.id}
                  checked={selectedGuestId === guest.id}
                  onChange={(e) => setSelectedGuestId(e.target.value)}
                  className="accent-pink"
                />
                <span className="text-sm font-medium text-dark">
                  {guest.first_name} {guest.last_name}
                </span>
              </label>
            ))}
          </div>
        </div>
      )}

      {selectedGuestId && (
        <div className="bg-white rounded-xl border border-sage/30 p-6">
          <h2 className="font-heading text-lg text-deep-sage mb-3">
            New Party Name
          </h2>
          <input
            type="text"
            value={newPartyName}
            onChange={(e) => setNewPartyName(e.target.value)}
            required
            className="w-full px-3 py-2 rounded-lg border border-sage/50 bg-white text-dark text-sm placeholder:text-dark/40 focus:outline-none focus:ring-2 focus:ring-pink focus:border-pink transition-colors"
          />
        </div>
      )}

      <button
        type="submit"
        disabled={isPending || !selectedGuestId || !newPartyName.trim()}
        className="w-full px-6 py-3 rounded-lg bg-pink text-dark font-medium hover:bg-pink/80 focus:outline-none focus:ring-2 focus:ring-pink focus:ring-offset-2 focus:ring-offset-cream transition-colors disabled:opacity-50"
      >
        {isPending ? "Moving..." : "Separate Guest to New Party"}
      </button>
    </form>
  );
}

// ─── Manage Events Form ─────────────────────────────────────

function ManageEventsForm({
  parties,
  isPending,
  startTransition,
  setError,
  setSuccess,
}: {
  parties: PartyOption[];
  isPending: boolean;
  startTransition: (fn: () => Promise<void>) => void;
  setError: (s: string) => void;
  setSuccess: (s: string) => void;
}) {
  const [selectedPartyId, setSelectedPartyId] = useState("");
  const [partySearch, setPartySearch] = useState("");
  const [events, setEvents] = useState<EventOption[]>([]);
  const [eventsLoaded, setEventsLoaded] = useState(false);
  const [activeEventIds, setActiveEventIds] = useState<Set<string>>(new Set());
  const [loadingEvents, setLoadingEvents] = useState(false);

  const filteredParties = partySearch.trim()
    ? parties.filter((p) =>
        p.invite_name.toLowerCase().includes(partySearch.toLowerCase())
      )
    : parties;

  // Load all events once
  useEffect(() => {
    if (!eventsLoaded) {
      listEvents().then((res) => {
        setEvents(res.events);
        setEventsLoaded(true);
      });
    }
  }, [eventsLoaded]);

  // Load party's current events when selection changes
  useEffect(() => {
    if (selectedPartyId) {
      setLoadingEvents(true);
      getPartyEvents(selectedPartyId).then((res) => {
        setActiveEventIds(new Set(res.eventIds));
        setLoadingEvents(false);
      });
    } else {
      setActiveEventIds(new Set());
    }
  }, [selectedPartyId]);

  function handleToggle(eventId: string, eventName: string) {
    const isCurrentlyActive = activeEventIds.has(eventId);
    setError("");
    setSuccess("");

    startTransition(async () => {
      if (isCurrentlyActive) {
        const result = await removePartyEvent(selectedPartyId, eventId);
        if (result.error) {
          setError(result.error);
        } else {
          setActiveEventIds((prev) => {
            const next = new Set(prev);
            next.delete(eventId);
            return next;
          });
          const party = parties.find((p) => p.id === selectedPartyId);
          setSuccess(`Removed "${eventName}" from ${party?.invite_name}.`);
        }
      } else {
        const result = await addPartyEvent(selectedPartyId, eventId);
        if (result.error) {
          setError(result.error);
        } else {
          setActiveEventIds((prev) => new Set(prev).add(eventId));
          const party = parties.find((p) => p.id === selectedPartyId);
          setSuccess(`Added "${eventName}" to ${party?.invite_name}.`);
        }
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-sage/30 p-6">
        <h2 className="font-heading text-lg text-deep-sage mb-3">
          Select Party
        </h2>
        <input
          type="text"
          placeholder="Search parties..."
          value={partySearch}
          onChange={(e) => setPartySearch(e.target.value)}
          className="w-full px-3 py-2 rounded-lg border border-sage/50 bg-white text-dark text-sm placeholder:text-dark/40 focus:outline-none focus:ring-2 focus:ring-pink focus:border-pink transition-colors mb-3"
        />
        <select
          value={selectedPartyId}
          onChange={(e) => setSelectedPartyId(e.target.value)}
          className="w-full px-3 py-2 rounded-lg border border-sage/50 bg-white text-dark text-sm focus:outline-none focus:ring-2 focus:ring-pink focus:border-pink transition-colors"
          size={Math.min(8, filteredParties.length + 1)}
        >
          <option value="">Choose a party...</option>
          {filteredParties.map((p) => (
            <option key={p.id} value={p.id}>
              {p.invite_name} ({p.party_size})
            </option>
          ))}
        </select>
      </div>

      {selectedPartyId && (
        <div className="bg-white rounded-xl border border-sage/30 p-6">
          <h2 className="font-heading text-lg text-deep-sage mb-4">
            Event Invitations
          </h2>
          {loadingEvents ? (
            <p className="text-sm text-dark/50">Loading events...</p>
          ) : (
            <div className="space-y-2">
              {events.map((event) => {
                const isActive = activeEventIds.has(event.id);
                return (
                  <label
                    key={event.id}
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg border cursor-pointer transition-colors ${
                      isActive
                        ? "border-pink bg-pink/5"
                        : "border-sage/30 hover:border-pink/50"
                    } ${isPending ? "opacity-50 pointer-events-none" : ""}`}
                  >
                    <input
                      type="checkbox"
                      checked={isActive}
                      onChange={() => handleToggle(event.id, event.name)}
                      disabled={isPending}
                      className="accent-pink w-4 h-4"
                    />
                    <span className="text-sm font-medium text-dark">
                      {event.name}
                    </span>
                    {isActive && (
                      <span className="ml-auto text-xs text-deep-sage bg-sage/20 px-2 py-0.5 rounded-full">
                        Invited
                      </span>
                    )}
                  </label>
                );
              })}
              <p className="text-xs text-dark/40 mt-3">
                Note: The wedding day and Friday Festivities are universal (all parties are invited). Toggle Rehearsal Dinner here for parties that need it.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Delete / Remove Form ───────────────────────────────────

function DeleteForm({
  parties,
  isPending,
  startTransition,
  setError,
  setSuccess,
  reloadParties,
}: {
  parties: PartyOption[];
  isPending: boolean;
  startTransition: (fn: () => Promise<void>) => void;
  setError: (s: string) => void;
  setSuccess: (s: string) => void;
  reloadParties: () => void;
}) {
  const [selectedPartyId, setSelectedPartyId] = useState("");
  const [partyGuests, setPartyGuests] = useState<GuestOption[]>([]);
  const [partySearch, setPartySearch] = useState("");
  const [confirmDeleteParty, setConfirmDeleteParty] = useState(false);
  const [confirmDeleteGuest, setConfirmDeleteGuest] = useState<string | null>(null);

  const filteredParties = partySearch.trim()
    ? parties.filter((p) =>
        p.invite_name.toLowerCase().includes(partySearch.toLowerCase())
      )
    : parties;

  useEffect(() => {
    if (selectedPartyId) {
      listGuestsInParty(selectedPartyId).then((res) => {
        setPartyGuests(res.guests);
      });
      setConfirmDeleteParty(false);
      setConfirmDeleteGuest(null);
    } else {
      setPartyGuests([]);
    }
  }, [selectedPartyId]);

  function handleDeleteParty() {
    if (!confirmDeleteParty) {
      setConfirmDeleteParty(true);
      return;
    }

    setError("");
    setSuccess("");
    startTransition(async () => {
      const result = await deleteParty(selectedPartyId);
      if (result.error) {
        setError(result.error);
      } else {
        setSuccess(`Deleted party "${result.partyName}" and all its guests.`);
        setSelectedPartyId("");
        setPartyGuests([]);
        setConfirmDeleteParty(false);
        reloadParties();
      }
    });
  }

  function handleDeleteGuest(guestId: string) {
    if (confirmDeleteGuest !== guestId) {
      setConfirmDeleteGuest(guestId);
      return;
    }

    setError("");
    setSuccess("");
    startTransition(async () => {
      const result = await deleteGuest(guestId);
      if (result.error) {
        setError(result.error);
      } else {
        if (result.partyDeleted) {
          setSuccess(`Deleted ${result.guestName}. Party was empty and has been removed.`);
          setSelectedPartyId("");
          setPartyGuests([]);
          reloadParties();
        } else {
          setSuccess(`Deleted ${result.guestName}.`);
          setPartyGuests((prev) => prev.filter((g) => g.id !== guestId));
          reloadParties();
        }
        setConfirmDeleteGuest(null);
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-sage/30 p-6">
        <h2 className="font-heading text-lg text-deep-sage mb-3">
          Select Party
        </h2>
        <input
          type="text"
          placeholder="Search parties..."
          value={partySearch}
          onChange={(e) => setPartySearch(e.target.value)}
          className="w-full px-3 py-2 rounded-lg border border-sage/50 bg-white text-dark text-sm placeholder:text-dark/40 focus:outline-none focus:ring-2 focus:ring-pink focus:border-pink transition-colors mb-3"
        />
        <select
          value={selectedPartyId}
          onChange={(e) => {
            setSelectedPartyId(e.target.value);
            setConfirmDeleteParty(false);
            setConfirmDeleteGuest(null);
          }}
          className="w-full px-3 py-2 rounded-lg border border-sage/50 bg-white text-dark text-sm focus:outline-none focus:ring-2 focus:ring-pink focus:border-pink transition-colors"
          size={Math.min(8, filteredParties.length + 1)}
        >
          <option value="">Choose a party...</option>
          {filteredParties.map((p) => (
            <option key={p.id} value={p.id}>
              {p.invite_name} ({p.party_size})
            </option>
          ))}
        </select>
      </div>

      {selectedPartyId && (
        <>
          {/* Individual guest removal */}
          <div className="bg-white rounded-xl border border-sage/30 p-6">
            <h2 className="font-heading text-lg text-deep-sage mb-4">
              Guests in Party
            </h2>
            <div className="space-y-2">
              {partyGuests.map((guest) => (
                <div
                  key={guest.id}
                  className="flex items-center justify-between px-4 py-3 rounded-lg border border-sage/30"
                >
                  <span className="text-sm font-medium text-dark">
                    {guest.first_name} {guest.last_name}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleDeleteGuest(guest.id)}
                    disabled={isPending}
                    className={`text-sm font-medium px-3 py-1 rounded-md transition-colors disabled:opacity-50 ${
                      confirmDeleteGuest === guest.id
                        ? "bg-red-600 text-white hover:bg-red-700"
                        : "text-red-600 hover:bg-red-50"
                    }`}
                  >
                    {confirmDeleteGuest === guest.id ? "Confirm Remove" : "Remove"}
                  </button>
                </div>
              ))}
              {partyGuests.length === 0 && (
                <p className="text-sm text-dark/50">No guests found.</p>
              )}
            </div>
          </div>

          {/* Delete entire party */}
          <div className="bg-white rounded-xl border border-red-200 p-6">
            <h2 className="font-heading text-lg text-red-700 mb-2">
              Delete Entire Party
            </h2>
            <p className="text-sm text-dark/60 mb-4">
              This will permanently remove the party, all its guests, their RSVPs, and dietary restrictions.
            </p>
            <button
              type="button"
              onClick={handleDeleteParty}
              disabled={isPending}
              className={`px-6 py-2 rounded-lg font-medium text-sm transition-colors disabled:opacity-50 ${
                confirmDeleteParty
                  ? "bg-red-600 text-white hover:bg-red-700"
                  : "bg-red-50 text-red-600 border border-red-200 hover:bg-red-100"
              }`}
            >
              {isPending
                ? "Deleting..."
                : confirmDeleteParty
                  ? "Click Again to Confirm Delete"
                  : "Delete Party"}
            </button>
            {confirmDeleteParty && (
              <button
                type="button"
                onClick={() => setConfirmDeleteParty(false)}
                className="ml-3 px-4 py-2 text-sm text-dark/60 hover:text-dark transition-colors"
              >
                Cancel
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
