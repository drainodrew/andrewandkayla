/**
 * add-new-guests.ts
 *
 * Adds new parties and guests to Supabase.
 * These guests are NOT invited to the rehearsal dinner (no party_events rows).
 * They will automatically see the wedding event (slug contains "wedding").
 *
 * Run with: npx tsx scripts/add-new-guests.ts
 */

import { readFileSync } from "fs";
import { join } from "path";
import { createClient } from "@supabase/supabase-js";

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
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  } catch {
    // env vars may be set another way
  }
}

loadEnv();

// Each entry: [invite_name, [[first, last], ...]]
// Entries with one name and no "&" / "and" are solo (party of 1).
// "Erin" has no last name provided, using empty string as placeholder.
const NEW_PARTIES: {
  invite_name: string;
  guests: { first_name: string; last_name: string; is_placeholder: boolean }[];
}[] = [
  {
    invite_name: "Jeff Bry",
    guests: [{ first_name: "Jeff", last_name: "Bry", is_placeholder: false }],
  },
  {
    invite_name: "Angel Cropper",
    guests: [{ first_name: "Angel", last_name: "Cropper", is_placeholder: false }],
  },
  {
    invite_name: "Erin",
    guests: [{ first_name: "Erin", last_name: "", is_placeholder: false }],
  },
  {
    invite_name: "Amy & Eric Gross",
    guests: [
      { first_name: "Amy", last_name: "Gross", is_placeholder: false },
      { first_name: "Eric", last_name: "Gross", is_placeholder: false },
    ],
  },
  {
    invite_name: "Hannah & Asher Black",
    guests: [
      { first_name: "Hannah", last_name: "Black", is_placeholder: false },
      { first_name: "Asher", last_name: "Black", is_placeholder: false },
    ],
  },
  {
    invite_name: "Mollie & Jonathan Alvarez",
    guests: [
      { first_name: "Mollie", last_name: "Alvarez", is_placeholder: false },
      { first_name: "Jonathan", last_name: "Alvarez", is_placeholder: false },
    ],
  },
  {
    invite_name: "Andrew Braveman & Ariele Kaplan",
    guests: [
      { first_name: "Andrew", last_name: "Braveman", is_placeholder: false },
      { first_name: "Ariele", last_name: "Kaplan", is_placeholder: false },
    ],
  },
  {
    invite_name: "Gerardo Chirino",
    guests: [{ first_name: "Gerardo", last_name: "Chirino", is_placeholder: false }],
  },
  {
    invite_name: "Sarah & Eric Davis",
    guests: [
      { first_name: "Sarah", last_name: "Davis", is_placeholder: false },
      { first_name: "Eric", last_name: "Davis", is_placeholder: false },
    ],
  },
  {
    invite_name: "Keyijah Owens",
    guests: [{ first_name: "Keyijah", last_name: "Owens", is_placeholder: false }],
  },
  {
    invite_name: "Deyna Jacobo",
    guests: [{ first_name: "Deyna", last_name: "Jacobo", is_placeholder: false }],
  },
  {
    invite_name: "Toni Hernandez",
    guests: [{ first_name: "Toni", last_name: "Hernandez", is_placeholder: false }],
  },
  {
    invite_name: "Angela & Waleska Rivera-Lear",
    guests: [
      { first_name: "Angela", last_name: "Rivera", is_placeholder: false },
      { first_name: "Waleska", last_name: "Rivera-Lear", is_placeholder: false },
    ],
  },
  {
    invite_name: "Jamie Paz & Natalie Mahmoud",
    guests: [
      { first_name: "Jamie", last_name: "Paz", is_placeholder: false },
      { first_name: "Natalie", last_name: "Mahmoud", is_placeholder: false },
    ],
  },
  {
    invite_name: "Dalena & Yensy Nieves",
    guests: [
      { first_name: "Dalena", last_name: "Nieves", is_placeholder: false },
      { first_name: "Yensy", last_name: "Nieves", is_placeholder: false },
    ],
  },
  {
    invite_name: "Courtney & Cason McInturff",
    guests: [
      { first_name: "Courtney", last_name: "McInturff", is_placeholder: false },
      { first_name: "Cason", last_name: "McInturff", is_placeholder: false },
    ],
  },
  {
    invite_name: "MereLove & Jack Carnes",
    guests: [
      { first_name: "MereLove", last_name: "Carnes", is_placeholder: false },
      { first_name: "Jack", last_name: "Carnes", is_placeholder: false },
    ],
  },
];

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
    process.exit(1);
  }

  const supabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let partiesInserted = 0;
  let guestsInserted = 0;
  let skipped = 0;

  for (const party of NEW_PARTIES) {
    // Check if party already exists
    const { data: existing } = await supabase
      .from("parties")
      .select("id")
      .eq("invite_name", party.invite_name)
      .maybeSingle();

    if (existing) {
      console.log(`  Skipping "${party.invite_name}" (already exists)`);
      skipped++;
      continue;
    }

    // Insert party
    const { data: partyData, error: partyError } = await supabase
      .from("parties")
      .insert({
        invite_name: party.invite_name,
        party_size: party.guests.length,
        source_tag: "wave-2",
      })
      .select("id")
      .single();

    if (partyError) {
      console.error(`  Failed to insert party "${party.invite_name}": ${partyError.message}`);
      continue;
    }

    console.log(`  Inserted party: "${party.invite_name}" (${party.guests.length} guests)`);
    partiesInserted++;

    // Insert guests
    for (const guest of party.guests) {
      const { error: guestError } = await supabase.from("guests").insert({
        party_id: partyData.id,
        first_name: guest.first_name,
        last_name: guest.last_name,
        is_placeholder: guest.is_placeholder,
      });

      if (guestError) {
        console.error(`    Failed to insert guest "${guest.first_name} ${guest.last_name}": ${guestError.message}`);
      } else {
        console.log(`    Inserted guest: ${guest.first_name} ${guest.last_name}`);
        guestsInserted++;
      }
    }

    // No party_events rows = wedding only (no rehearsal dinner)
  }

  console.log(`\nDone: ${partiesInserted} parties, ${guestsInserted} guests inserted, ${skipped} skipped.`);
  console.log("These guests will see the wedding event only (no rehearsal dinner).");
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
