/**
 * add-wave3-guests.ts
 *
 * Adds wave-3 parties and guests to Supabase.
 * Also adds Caden Wegner to the existing Will & Shauna Wegner party.
 *
 * Run with: npx tsx scripts/add-wave3-guests.ts
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

const NEW_PARTIES: {
  invite_name: string;
  guests: { first_name: string; last_name: string; is_placeholder: boolean }[];
}[] = [
  {
    invite_name: "Arie & Chandler Wegner",
    guests: [
      { first_name: "Arie", last_name: "Wegner", is_placeholder: false },
      { first_name: "Chandler", last_name: "Wegner", is_placeholder: false },
    ],
  },
  {
    invite_name: "McKenna Wegner & Stephen Harewood",
    guests: [
      { first_name: "McKenna", last_name: "Wegner", is_placeholder: false },
      { first_name: "Stephen", last_name: "Harewood", is_placeholder: false },
    ],
  },
  {
    invite_name: "Ashlynn & Connor Johnston",
    guests: [
      { first_name: "Ashlynn", last_name: "Johnston", is_placeholder: false },
      { first_name: "Connor", last_name: "Johnston", is_placeholder: false },
    ],
  },
  {
    invite_name: "Madyson & Tyler Webster",
    guests: [
      { first_name: "Madyson", last_name: "Webster", is_placeholder: false },
      { first_name: "Tyler", last_name: "Webster", is_placeholder: false },
    ],
  },
  {
    invite_name: "Alex & Hayden Spetka",
    guests: [
      { first_name: "Alex", last_name: "Spetka", is_placeholder: false },
      { first_name: "Hayden", last_name: "Spetka", is_placeholder: false },
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

  // ── Step 1: Add Caden Wegner to existing Will & Shauna Wegner party ──

  console.log("Looking up Will & Shauna Wegner party...");
  const { data: willParty, error: willError } = await supabase
    .from("parties")
    .select("id, invite_name, party_size")
    .ilike("invite_name", "%Will%Shauna%Wegner%")
    .maybeSingle();

  if (willError) {
    console.error("Error looking up Will & Shauna Wegner:", willError.message);
  } else if (!willParty) {
    console.error("Could not find Will & Shauna Wegner party. Skipping Caden.");
  } else {
    // Check if Caden already exists in this party
    const { data: existingCaden } = await supabase
      .from("guests")
      .select("id")
      .eq("party_id", willParty.id)
      .eq("first_name", "Caden")
      .eq("last_name", "Wegner")
      .maybeSingle();

    if (existingCaden) {
      console.log("  Caden Wegner already exists in this party. Skipping.");
    } else {
      const { error: cadenError } = await supabase.from("guests").insert({
        party_id: willParty.id,
        first_name: "Caden",
        last_name: "Wegner",
        is_placeholder: false,
      });

      if (cadenError) {
        console.error("  Failed to insert Caden Wegner:", cadenError.message);
      } else {
        console.log(`  Added Caden Wegner to "${willParty.invite_name}"`);

        // Update party_size
        const newSize = willParty.party_size + 1;
        const { error: sizeError } = await supabase
          .from("parties")
          .update({ party_size: newSize })
          .eq("id", willParty.id);

        if (sizeError) {
          console.error("  Failed to update party_size:", sizeError.message);
        } else {
          console.log(`  Updated party_size: ${willParty.party_size} -> ${newSize}`);
        }
      }
    }
  }

  // ── Step 2: Add new parties ──

  console.log("\nAdding new parties...");
  let partiesInserted = 0;
  let guestsInserted = 0;
  let skipped = 0;

  for (const party of NEW_PARTIES) {
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

    const { data: partyData, error: partyError } = await supabase
      .from("parties")
      .insert({
        invite_name: party.invite_name,
        party_size: party.guests.length,
        source_tag: "wave-3",
      })
      .select("id")
      .single();

    if (partyError) {
      console.error(`  Failed to insert party "${party.invite_name}": ${partyError.message}`);
      continue;
    }

    console.log(`  Inserted party: "${party.invite_name}" (${party.guests.length} guests)`);
    partiesInserted++;

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
  }

  console.log(`\nDone: ${partiesInserted} parties, ${guestsInserted} guests inserted, ${skipped} skipped.`);
  console.log("These guests will see the wedding event only (no rehearsal dinner).");
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
