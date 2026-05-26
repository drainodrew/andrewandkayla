/**
 * import-rehearsal-parties.ts
 *
 * Reads the rehearsal dinner CSV, matches each party to an existing
 * party in Supabase (by invite_name), and creates party_events rows
 * so those parties see the rehearsal dinner in their RSVP flow.
 *
 * Also creates party_events rows for friday-game-day for ALL parties
 * (everyone is invited to game day).
 *
 * Prerequisites:
 *   1. Run the party_events migration (20260526000001_party_events.sql)
 *   2. Run seed-events.ts so friday-game-day and rehearsal-dinner exist
 *   3. Guests already loaded via load-guests.ts
 *
 * Run with: npx tsx scripts/import-rehearsal-parties.ts
 *
 * This script does NOT create new parties or guests. It only links
 * existing parties to events. If a rehearsal party doesn't match
 * an existing party name, it's reported as a warning so Andrew can
 * fix the name mapping.
 */

import { readFileSync } from "fs";
import { join } from "path";
import { createClient } from "@supabase/supabase-js";

// --- Load env ---

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

// --- CSV parsing (same as import-guests.ts) ---

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.split("\n").filter((line) => line.trim() !== "");
  if (lines.length === 0) return [];

  const headers = parseCSVLine(lines[0]);
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const row: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = (values[j] || "").trim();
    }
    rows.push(row);
  }

  return rows;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ",") {
        result.push(current);
        current = "";
      } else {
        current += char;
      }
    }
  }
  result.push(current);
  return result;
}

// --- Name normalization ---

/**
 * Some names in the rehearsal CSV may differ slightly from the main
 * guest list (trailing spaces, "The X Family" vs how it was imported).
 * This map handles known mismatches.
 * Key: name as it appears in the rehearsal CSV
 * Value: name as it appears in Supabase parties.invite_name
 */
const NAME_ALIASES: Record<string, string> = {
  "William Trapnell": "William Trapnell & Summer Moffett",
  "Joe & Julia Moore": "The Moore Family",
  "Jackson Krodel": "Jackson Krodel & Charlotte Flowers",
};

// --- Main ---

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    console.error("Missing Supabase env vars.");
    process.exit(1);
  }

  const supabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // 1. Read rehearsal CSV
  const csvPath = join(
    __dirname,
    "Updated_Wedding_Mailing_List_rehearsal_-_rehearsal_dinner-2 - rehearsal dinner.csv"
  );
  const raw = readFileSync(csvPath, "utf-8");
  const rows = parseCSV(raw);

  // Extract rehearsal party names (skip empty/total rows)
  const rehearsalNames: string[] = [];
  for (const row of rows) {
    const name = (row["Name(s)"] || "").trim();
    if (!name) continue;
    rehearsalNames.push(name);
  }

  console.log(`Found ${rehearsalNames.length} parties in rehearsal CSV.\n`);

  // 2. Fetch all parties from Supabase
  const { data: allParties, error: partiesErr } = await supabase
    .from("parties")
    .select("id, invite_name");

  if (partiesErr || !allParties) {
    console.error("Failed to fetch parties:", partiesErr?.message);
    process.exit(1);
  }

  // Build lookup: normalized name -> party id
  const partyLookup = new Map<string, string>();
  for (const p of allParties) {
    partyLookup.set(p.invite_name.trim(), p.id);
  }

  // 3. Fetch events
  const { data: events, error: eventsErr } = await supabase
    .from("events")
    .select("id, slug");

  if (eventsErr || !events) {
    console.error("Failed to fetch events:", eventsErr?.message);
    process.exit(1);
  }

  const eventMap = new Map<string, string>();
  for (const e of events) {
    eventMap.set(e.slug, e.id);
  }

  const gameDayId = eventMap.get("friday-game-day");
  const rehearsalId = eventMap.get("rehearsal-dinner");

  if (!gameDayId || !rehearsalId) {
    console.error(
      "Events not found in DB. Run seed-events.ts first.\n" +
        `  Found slugs: ${events.map((e) => e.slug).join(", ")}`
    );
    process.exit(1);
  }

  // 4. Match rehearsal parties and create party_events for rehearsal dinner
  const matched: { partyId: string; name: string }[] = [];
  const unmatched: string[] = [];

  for (const name of rehearsalNames) {
    const alias = NAME_ALIASES[name] || name;
    const partyId = partyLookup.get(alias);
    if (partyId) {
      matched.push({ partyId, name });
    } else {
      unmatched.push(name);
    }
  }

  console.log(`Matched: ${matched.length} parties`);
  if (unmatched.length > 0) {
    console.log(`\nUnmatched (${unmatched.length}):`);
    for (const name of unmatched) {
      console.log(`  - "${name}"`);
    }
    console.log(
      "\nAdd these to NAME_ALIASES in this script if they exist under a different name in Supabase.\n"
    );
  }

  // 5. Insert party_events for rehearsal dinner (matched parties only)
  let rehearsalInserted = 0;
  let rehearsalSkipped = 0;

  for (const { partyId, name } of matched) {
    const { error } = await supabase
      .from("party_events")
      .upsert(
        { party_id: partyId, event_id: rehearsalId },
        { onConflict: "party_id,event_id" }
      );

    if (error) {
      console.error(`  Failed rehearsal link for "${name}": ${error.message}`);
      rehearsalSkipped++;
    } else {
      rehearsalInserted++;
    }
  }

  console.log(
    `\nRehearsal dinner: ${rehearsalInserted} linked, ${rehearsalSkipped} failed.`
  );

  // 6. Insert party_events for game day (ALL parties)
  let gameDayInserted = 0;
  let gameDaySkipped = 0;

  for (const party of allParties) {
    const { error } = await supabase
      .from("party_events")
      .upsert(
        { party_id: party.id, event_id: gameDayId },
        { onConflict: "party_id,event_id" }
      );

    if (error) {
      console.error(
        `  Failed game day link for "${party.invite_name}": ${error.message}`
      );
      gameDaySkipped++;
    } else {
      gameDayInserted++;
    }
  }

  console.log(
    `Game day: ${gameDayInserted} linked, ${gameDaySkipped} failed.`
  );

  console.log("\nDone.");
  if (unmatched.length > 0) {
    console.log(
      `\nAction needed: ${unmatched.length} rehearsal parties didn't match. ` +
        `Fix NAME_ALIASES and re-run.`
    );
  }
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
