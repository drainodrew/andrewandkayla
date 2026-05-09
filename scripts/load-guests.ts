/**
 * load-guests.ts
 *
 * Reads the parsed preview CSVs and loads them into Supabase.
 * Run import-guests.ts first to generate the preview CSVs.
 *
 * Run with: npx tsx scripts/load-guests.ts
 *
 * What this script does:
 * 1. Reads parsed_parties_preview.csv and parsed_guests_preview.csv
 * 2. Inserts parties into the parties table
 * 3. Inserts guests into the guests table, linked to their party
 * 4. Reports what was inserted and any errors
 *
 * This script is idempotent-ish: it checks for existing parties by
 * invite_name before inserting. If a party already exists, it skips it.
 * To re-import, delete the data from Supabase first.
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
 * in .env.local (or environment).
 */

import { readFileSync } from "fs";
import { join } from "path";
import { createClient } from "@supabase/supabase-js";

// --- Load env from .env.local ---

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
    // .env.local might not exist if env vars are set another way
  }
}

loadEnv();

// --- CSV parsing (same minimal parser as import-guests.ts) ---

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

// --- Main ---

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    console.error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.\n" +
        "Set them in .env.local or as environment variables."
    );
    process.exit(1);
  }

  const supabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Read the preview CSVs
  const partiesPath = join(__dirname, "parsed_parties_preview.csv");
  const guestsPath = join(__dirname, "parsed_guests_preview.csv");

  let partiesRaw: string;
  let guestsRaw: string;
  try {
    partiesRaw = readFileSync(partiesPath, "utf-8");
    guestsRaw = readFileSync(guestsPath, "utf-8");
  } catch {
    console.error(
      "Preview CSVs not found. Run import-guests.ts first:\n" +
        "  npx tsx scripts/import-guests.ts"
    );
    process.exit(1);
  }

  const partyRows = parseCSV(partiesRaw);
  const guestRows = parseCSV(guestsRaw);

  console.log(
    `Read ${partyRows.length} parties and ${guestRows.length} guests from preview CSVs.\n`
  );

  // Check for existing data
  const { count: existingCount } = await supabase
    .from("parties")
    .select("*", { count: "exact", head: true });

  if (existingCount && existingCount > 0) {
    console.error(
      `Supabase already has ${existingCount} parties. ` +
        `Delete existing data first if you want to re-import.\n` +
        `Run in Supabase SQL Editor:\n` +
        `  DELETE FROM guests; DELETE FROM parties;`
    );
    process.exit(1);
  }

  // Insert parties and build a map of invite_name -> party_id
  const partyIdMap = new Map<string, string>();
  let partiesInserted = 0;
  let partiesFailed = 0;

  for (const row of partyRows) {
    const { data, error } = await supabase
      .from("parties")
      .insert({
        invite_name: row.invite_name,
        party_size: parseInt(row.party_size, 10),
        address_line_1: row.address_line_1 || null,
        address_line_2: row.address_line_2 || null,
        city: row.city || null,
        state: row.state || null,
        zip_code: row.zip_code || null,
        phone: row.phone || null,
        email: row.email || null,
        source_tag: row.source_tag || null,
        hidden_from_search: row.hidden_from_search === "true",
      })
      .select("id")
      .single();

    if (error) {
      console.error(`  Failed to insert party "${row.invite_name}": ${error.message}`);
      partiesFailed++;
    } else {
      partyIdMap.set(row.invite_name, data.id);
      partiesInserted++;
    }
  }

  console.log(
    `Parties: ${partiesInserted} inserted, ${partiesFailed} failed.\n`
  );

  // Insert guests
  let guestsInserted = 0;
  let guestsFailed = 0;
  let guestsSkipped = 0;

  for (const row of guestRows) {
    const partyId = partyIdMap.get(row.party_invite_name);
    if (!partyId) {
      console.error(
        `  Skipping guest "${row.first_name} ${row.last_name}": ` +
          `no party found for "${row.party_invite_name}"`
      );
      guestsSkipped++;
      continue;
    }

    const { error } = await supabase.from("guests").insert({
      party_id: partyId,
      first_name: row.first_name,
      last_name: row.last_name,
      is_placeholder: row.is_placeholder === "true",
    });

    if (error) {
      console.error(
        `  Failed to insert guest "${row.first_name} ${row.last_name}": ${error.message}`
      );
      guestsFailed++;
    } else {
      guestsInserted++;
    }
  }

  console.log(
    `Guests: ${guestsInserted} inserted, ${guestsFailed} failed, ${guestsSkipped} skipped.\n`
  );

  if (partiesFailed === 0 && guestsFailed === 0 && guestsSkipped === 0) {
    console.log("All data loaded successfully.");
  } else {
    console.log("Some records had issues. Review the errors above.");
  }
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
