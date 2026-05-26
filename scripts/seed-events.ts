/**
 * seed-events.ts
 *
 * Seeds the events table with the wedding events.
 * Run with: npx tsx scripts/seed-events.ts
 *
 * Andrew: update the times, descriptions, and dress codes here
 * before running. These are placeholder values.
 */

import { readFileSync } from "fs";
import { join } from "path";
import { createClient } from "@supabase/supabase-js";

// Load .env.local
function loadEnv() {
  try {
    const envPath = join(__dirname, "..", ".env.local");
    const envFile = readFileSync(envPath, "utf-8");
    for (const line of envFile.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIndex = trimmed.indexOf("=");
      if (eqIndex === -1) continue;
      const key = trimmed.slice(0, eqIndex);
      const value = trimmed.slice(eqIndex + 1);
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    // env vars may be set another way
  }
}

loadEnv();

const events = [
  {
    slug: "friday-game-day",
    name: "Friday Festivities",
    starts_at: "2026-08-28T12:30:00-05:00",
    ends_at: "2026-08-28T15:30:00-05:00",
    location: "1422 Franklin Rd",
    address: "1422 Franklin Rd, Brentwood, TN 37027",
    dress_code: null,
    description: "Join us for an afternoon of games, snacks & friendly competition.",
    sort_order: 1,
  },
  {
    slug: "rehearsal-dinner",
    name: "Rehearsal Dinner",
    starts_at: "2026-08-28T18:15:00-05:00",
    ends_at: "2026-08-28T21:30:00-05:00",
    location: "Brentwood Country Club",
    address: "5123 Country Club Dr, Brentwood, TN 37027",
    dress_code: "Garden Formal",
    description: "Dinner and toasts the night before the big day.",
    sort_order: 2,
  },
  {
    slug: "wedding-ceremony-reception",
    name: "Wedding Ceremony & Reception",
    starts_at: "2026-08-29T17:00:00-05:00",
    ends_at: "2026-08-29T23:00:00-05:00",
    location: "Belle Meade Mansion",
    address: "110 Leake Ave, Nashville, TN 37205",
    dress_code: "Garden Formal",
    description: "Join us as we say our vows and celebrate with dinner and dancing.",
    sort_order: 3,
  },
];

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  if (!url || !key) {
    console.error("Missing Supabase env vars.");
    process.exit(1);
  }

  const supabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  for (const event of events) {
    const { error } = await supabase.from("events").upsert(event, {
      onConflict: "slug",
    });

    if (error) {
      console.error(`Failed to insert "${event.name}":`, error.message);
    } else {
      console.log(`Inserted: ${event.name}`);
    }
  }

  console.log("\nDone. Add more events to this file as needed.");
}

main().catch(console.error);
