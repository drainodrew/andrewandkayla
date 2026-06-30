"use client";

import { useState, useEffect, useCallback } from "react";
import { GuestSearch } from "./guest-search";
import { RsvpForm } from "./rsvp-form";
import { getRsvpSession } from "@/lib/actions/rsvp";

interface SessionData {
  party: { id: string; invite_name: string; party_size: number } | null;
  guests: {
    id: string;
    first_name: string;
    last_name: string;
    is_placeholder: boolean;
  }[] | null;
  events: {
    id: string;
    slug: string;
    name: string;
    starts_at: string | null;
    ends_at: string | null;
    location: string | null;
    dress_code: string | null;
    description: string | null;
  }[] | null;
  rsvps?: Record<string, Record<string, string>>;
  dietaryNotes?: Record<string, string>;
  invitedGuestsByEvent?: Record<string, string[]>;
}

export function RsvpFlow() {
  const [session, setSession] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState(true);

  const loadSession = useCallback(async () => {
    setLoading(true);
    const data = await getRsvpSession();
    setSession(data as SessionData);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  if (loading) {
    return (
      <p className="text-center text-dark/50">...</p>
    );
  }

  // If we have a valid session with party data, show the RSVP form
  if (session?.party && session?.guests && session?.events) {
    return (
      <RsvpForm
        partyName={session.party.invite_name}
        guests={session.guests}
        events={session.events}
        existingRsvps={session.rsvps || {}}
        existingDietary={session.dietaryNotes || {}}
        invitedGuestsByEvent={session.invitedGuestsByEvent || {}}
        onSessionCleared={loadSession}
      />
    );
  }

  // Otherwise show the search
  return <GuestSearch onPartySelected={loadSession} />;
}
