/**
 * add-dwight-queen.ts
 *
 * Adds Dave Dwight & Emily Queen as a new party.
 * Invited to: wedding (automatic) + friday game day (party_events row).
 * NOT invited to rehearsal dinner.
 *
 * Run with: npx tsx scripts/add-dwight-queen.ts
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

  const INVITE_NAME = "Dave Dwight & Emily Queen";

  // Check if party already exists
  const { data: existing } = await supabase
    .from("parties")
    .select("id")
    .eq("invite_name", INVITE_NAME)
    .maybeSingle();

  if (existing) {
    console.log(`"${INVITE_NAME}" already exists. Skipping party/guest creation.`);
    console.log("Ensuring game day invite exists...");

    // Still ensure party_events row exists
    await ensureGameDay(supabase, existing.id, INVITE_NAME);
    return;
  }

  // Insert party
  const { data: partyData, error: partyError } = await supabase
    .from("parties")
    .insert({
      invite_name: INVITE_NAME,
      party_size: 2,
      source_tag: "wave-4",
    })
    .select("id")
    .single();

  if (partyError) {
    console.error(`Failed to insert party: ${partyError.message}`);
    process.exit(1);
  }

  console.log(`Inserted party: "${INVITE_NAME}"`);

  // Insert guests
  const guests = [
    { first_name: "Dave", last_name: "Dwight", is_placeholder: false },
    { first_name: "Emily", last_name: "Queen", is_placeholder: false },
  ];

  for (const guest of guests) {
    const { error } = await supabase.from("guests").insert({
      party_id: partyData.id,
      ...guest,
    });

    if (error) {
      console.error(`Failed to insert ${guest.first_name} ${guest.last_name}: ${error.message}`);
    } else {
      console.log(`  Inserted guest: ${guest.first_name} ${guest.last_name}`);
    }
  }

  // Add friday game day invite (party_events row)
  await ensureGameDay(supabase, partyData.id, INVITE_NAME);

  console.log("\nDone. They will see: Friday Festivities + Wedding (no rehearsal dinner).");
}

async function ensureGameDay(
  supabase: ReturnType<typeof createClient>,
  partyId: string,
  inviteName: string
) {
  // Look up friday-game-day event
  const { data: gameDayEvent, error: eventError } = await supabase
    .from("events")
    .select("id")
    .eq("slug", "friday-game-day")
    .single();

  if (eventError || !gameDayEvent) {
    console.error("Could not find friday-game-day event. Run seed-events.ts first.");
    return;
  }

  const { error } = await supabase
    .from("party_events")
    .upsert(
      { party_id: partyId, event_id: gameDayEvent.id },
      { onConflict: "party_id,event_id" }
    );

  if (error) {
    console.error(`Failed to link "${inviteName}" to game day: ${error.message}`);
  } else {
    console.log(`  Linked "${inviteName}" to Friday Festivities`);
  }
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
