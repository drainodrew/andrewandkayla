import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";

/**
 * GET /api/guest-lookup?q=search_term
 *
 * Searches guests by first_name, last_name, or the party's invite_name.
 * Returns matching parties (not individual guests) to avoid showing
 * the same couple twice.
 *
 * Security: minimum 3 characters, rate-limited, max 10 results,
 * only returns party_id and display_name. No addresses, emails,
 * or phones ever leave the server.
 */
export async function GET(request: NextRequest) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown";

  const { allowed } = rateLimit(ip, 30, 60_000);
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many requests. Try again in a minute." },
      { status: 429 }
    );
  }

  const q = request.nextUrl.searchParams.get("q")?.trim() || "";

  if (q.length < 3) {
    return NextResponse.json(
      { error: "Search query must be at least 3 characters." },
      { status: 400 }
    );
  }

  const supabase = createServiceClient();
  const searchTerm = `%${q}%`;

  // Find guests whose first_name or last_name matches,
  // or whose party's invite_name matches.
  // Return distinct parties, not individual guests.
  const { data, error } = await supabase
    .from("guests")
    .select(
      `
      party_id,
      parties!inner (
        id,
        invite_name,
        party_size,
        hidden_from_search
      )
    `
    )
    .or(`first_name.ilike.${searchTerm},last_name.ilike.${searchTerm}`)
    .eq("parties.hidden_from_search", false)
    .limit(50);

  if (error) {
    console.error("Guest lookup error:", error);
    return NextResponse.json(
      { error: "Search failed. Please try again." },
      { status: 500 }
    );
  }

  // Also search by party invite_name for "Wegner Family" type searches
  const { data: partyMatches, error: partyError } = await supabase
    .from("parties")
    .select("id, invite_name, party_size")
    .ilike("invite_name", searchTerm)
    .eq("hidden_from_search", false)
    .limit(10);

  if (partyError) {
    console.error("Party lookup error:", partyError);
  }

  // Deduplicate parties by id
  const partyMap = new Map<
    string,
    { party_id: string; display_name: string; party_size: number }
  >();

  // Add matches from guest name search
  if (data) {
    for (const row of data) {
      const party = row.parties as unknown as {
        id: string;
        invite_name: string;
        party_size: number;
        hidden_from_search: boolean;
      };
      if (!partyMap.has(party.id)) {
        partyMap.set(party.id, {
          party_id: party.id,
          display_name: party.invite_name,
          party_size: party.party_size,
        });
      }
    }
  }

  // Add matches from invite_name search
  if (partyMatches) {
    for (const party of partyMatches) {
      if (!partyMap.has(party.id)) {
        partyMap.set(party.id, {
          party_id: party.id,
          display_name: party.invite_name,
          party_size: party.party_size,
        });
      }
    }
  }

  // Only return party_id, display_name, and party_size
  const results = Array.from(partyMap.values()).slice(0, 10);

  return NextResponse.json({ results });
}
