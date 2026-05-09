"use client";

import { useState } from "react";
import Link from "next/link";
import { submitRsvp, clearRsvpSession } from "@/lib/actions/rsvp";

interface Guest {
  id: string;
  first_name: string;
  last_name: string;
  is_placeholder: boolean;
}

interface Event {
  id: string;
  slug: string;
  name: string;
  starts_at: string | null;
  ends_at: string | null;
  location: string | null;
  dress_code: string | null;
  description: string | null;
}

interface RsvpFormProps {
  partyName: string;
  guests: Guest[];
  events: Event[];
  existingRsvps: Record<string, Record<string, string>>;
  existingDietary: Record<string, string>;
  onSessionCleared: () => void;
}

export function RsvpForm({
  partyName,
  guests,
  events,
  existingRsvps,
  existingDietary,
  onSessionCleared,
}: RsvpFormProps) {
  // State: rsvps[guestId][eventId] = "attending" | "declined"
  const [rsvps, setRsvps] = useState<Record<string, Record<string, string>>>(
    () => {
      const initial: Record<string, Record<string, string>> = {};
      for (const guest of guests) {
        initial[guest.id] = {};
        for (const event of events) {
          initial[guest.id][event.id] =
            existingRsvps[guest.id]?.[event.id] || "";
        }
      }
      return initial;
    }
  );

  const [dietary, setDietary] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const guest of guests) {
      initial[guest.id] = existingDietary[guest.id] || "";
    }
    return initial;
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const toggleRsvp = (
    guestId: string,
    eventId: string,
    status: "attending" | "declined"
  ) => {
    setRsvps((prev) => ({
      ...prev,
      [guestId]: {
        ...prev[guestId],
        [eventId]: prev[guestId][eventId] === status ? "" : status,
      },
    }));
  };

  const handleSubmit = async () => {
    // Validate: every guest must have a response for every event
    const incomplete: string[] = [];
    for (const guest of guests) {
      for (const event of events) {
        if (!rsvps[guest.id]?.[event.id]) {
          incomplete.push(
            `${guest.first_name} ${guest.last_name} for ${event.name}`
          );
        }
      }
    }

    if (incomplete.length > 0) {
      setError(
        `Please respond for everyone: ${incomplete.slice(0, 3).join(", ")}${
          incomplete.length > 3 ? ` and ${incomplete.length - 3} more` : ""
        }`
      );
      return;
    }

    setIsSubmitting(true);
    setError("");

    const rsvpList: {
      guestId: string;
      eventId: string;
      status: "attending" | "declined";
    }[] = [];

    for (const guest of guests) {
      for (const event of events) {
        rsvpList.push({
          guestId: guest.id,
          eventId: event.id,
          status: rsvps[guest.id][event.id] as "attending" | "declined",
        });
      }
    }

    const dietaryList = guests.map((g) => ({
      guestId: g.id,
      notes: dietary[g.id] || "",
    }));

    const result = await submitRsvp({
      rsvps: rsvpList,
      dietaryRestrictions: dietaryList,
    });

    if (result.error) {
      setError(result.error);
    } else {
      setSubmitted(true);
    }

    setIsSubmitting(false);
  };

  const handleSwitchParty = async () => {
    await clearRsvpSession();
    onSessionCleared();
  };

  if (submitted) {
    return (
      <div className="mx-auto max-w-lg text-center">
        <h2 className="text-3xl font-heading text-deep-sage mb-4">
          Thank you!
        </h2>
        <p className="text-dark/80 mb-8">
          Your RSVP for {partyName} has been saved. You can come back and
          update it anytime before the wedding.
        </p>

        <div className="grid grid-cols-3 gap-3 mb-8">
          <Link
            href="/schedule"
            className="rounded-xl border border-sage/30 bg-white p-4 text-sm font-medium text-dark transition-colors hover:border-pink hover:bg-pink/5 focus:outline-none focus:ring-2 focus:ring-sage"
          >
            Schedule
          </Link>
          <Link
            href="/registry"
            className="rounded-xl border-2 border-pink bg-pink/10 p-4 text-sm font-medium text-dark transition-colors hover:bg-pink/20 focus:outline-none focus:ring-2 focus:ring-sage"
          >
            Registry
          </Link>
          <Link
            href="/things-to-do"
            className="rounded-xl border border-sage/30 bg-white p-4 text-sm font-medium text-dark transition-colors hover:border-pink hover:bg-pink/5 focus:outline-none focus:ring-2 focus:ring-sage"
          >
            Things To Do
          </Link>
        </div>

        <button
          type="button"
          onClick={() => setSubmitted(false)}
          className="text-sm text-dark/50 underline hover:text-dark/70"
        >
          Update RSVP
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-heading text-deep-sage">{partyName}</h2>
          <p className="text-sm text-dark/60 mt-1">
            Party of {guests.length}
          </p>
        </div>
        <button
          type="button"
          onClick={handleSwitchParty}
          className="text-sm text-dark/50 underline hover:text-dark/70"
        >
          Not you?
        </button>
      </div>

      {events.length === 0 ? (
        <p className="text-dark/60">
          No events have been added yet. Check back soon!
        </p>
      ) : (
        <div className="space-y-8">
          {events.map((event) => (
            <div
              key={event.id}
              className="rounded-xl border border-sage/30 bg-white p-6"
            >
              <h3 className="text-lg font-heading text-deep-sage mb-1">
                {event.name}
              </h3>
              {event.location && (
                <p className="text-sm text-dark/60 mb-1">{event.location}</p>
              )}
              {event.starts_at && (
                <p className="text-sm text-dark/60 mb-1">
                  {new Date(event.starts_at).toLocaleDateString("en-US", {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}
                  {event.ends_at && (
                    <>
                      {" "}
                      &middot;{" "}
                      {new Date(event.starts_at).toLocaleTimeString("en-US", {
                        hour: "numeric",
                        minute: "2-digit",
                      })}{" "}
                      to{" "}
                      {new Date(event.ends_at).toLocaleTimeString("en-US", {
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </>
                  )}
                </p>
              )}
              {event.dress_code && (
                <p className="text-sm text-dark/60 mb-4">
                  Dress code: {event.dress_code}
                </p>
              )}
              {event.description && (
                <p className="text-sm text-dark/70 mb-4">
                  {event.description}
                </p>
              )}

              <div className="mt-4 space-y-3">
                {guests.map((guest) => (
                  <div
                    key={guest.id}
                    className="flex items-center justify-between gap-4"
                  >
                    <span className="text-sm font-medium">
                      {guest.first_name} {guest.last_name}
                    </span>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          toggleRsvp(guest.id, event.id, "attending")
                        }
                        className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-sage ${
                          rsvps[guest.id]?.[event.id] === "attending"
                            ? "bg-pink text-dark"
                            : "border border-sage/40 text-dark/60 hover:border-pink"
                        }`}
                      >
                        Attending
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          toggleRsvp(guest.id, event.id, "declined")
                        }
                        className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-sage ${
                          rsvps[guest.id]?.[event.id] === "declined"
                            ? "bg-dark/10 text-dark"
                            : "border border-sage/40 text-dark/60 hover:border-dark/30"
                        }`}
                      >
                        Decline
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Dietary restrictions */}
          <div className="rounded-xl border border-sage/30 bg-white p-6">
            <h3 className="text-lg font-heading text-deep-sage mb-4">
              Dietary Restrictions
            </h3>
            <div className="space-y-4">
              {guests.map((guest) => (
                <div key={guest.id}>
                  <label
                    htmlFor={`dietary-${guest.id}`}
                    className="block text-sm font-medium mb-1"
                  >
                    {guest.first_name} {guest.last_name}
                  </label>
                  <input
                    id={`dietary-${guest.id}`}
                    type="text"
                    value={dietary[guest.id] || ""}
                    onChange={(e) =>
                      setDietary((prev) => ({
                        ...prev,
                        [guest.id]: e.target.value,
                      }))
                    }
                    placeholder="Allergies, vegetarian, etc."
                    className="w-full rounded-lg border border-sage/50 bg-white px-3 py-2 text-sm text-dark placeholder:text-dark/30 focus:outline-none focus:ring-2 focus:ring-pink focus:border-transparent"
                  />
                </div>
              ))}
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-600 text-center">{error}</p>
          )}

          <div className="text-center pt-2 pb-4">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="rounded-lg bg-pink px-8 py-3 font-medium text-dark transition-colors hover:bg-pink/80 focus:outline-none focus:ring-2 focus:ring-sage disabled:opacity-50"
            >
              {isSubmitting ? "Saving..." : "Submit RSVP"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
