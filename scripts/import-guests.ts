/**
 * import-guests.ts
 *
 * Reads invite-addresses.csv (GHL export) and outputs
 * parsed_guests_preview.csv for human review before loading to Supabase.
 *
 * Run with: npx tsx scripts/import-guests.ts
 *
 * What this script does:
 * 1. Parses the messy GHL CSV (quoted fields, extra columns, bad addresses)
 * 2. Splits "Name1 & Name2" into individual guests
 * 3. Creates placeholder "Guest of X" rows when count > named people
 * 4. Cleans address data (strips "add", "Need to add address", etc.)
 * 5. Maps GHL "stage" column to source_tag
 * 6. Outputs two CSVs:
 *    - parsed_parties_preview.csv  (one row per party)
 *    - parsed_guests_preview.csv   (one row per guest)
 *
 * Does NOT touch the database. That's load-guests.ts (session 2).
 */

import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

// --- Types ---

interface RawRow {
  "Name(s)": string;
  Count: string;
  Address: string;
  "Address 2": string;
  City: string;
  State: string;
  "Zip Code": string;
  phone: string;
  email: string;
  stage: string;
  "Contact Name": string;
  Notes: string;
}

interface ParsedParty {
  invite_name: string;
  party_size: number;
  address_line_1: string;
  address_line_2: string;
  city: string;
  state: string;
  zip_code: string;
  phone: string;
  email: string;
  source_tag: string;
  notes: string;
  hidden_from_search: boolean;
}

interface ParsedGuest {
  party_invite_name: string;
  first_name: string;
  last_name: string;
  is_placeholder: boolean;
}

// --- CSV parsing ---

/**
 * Minimal CSV parser that handles quoted fields with commas.
 * We're not pulling in a dependency for this; the GHL export is
 * simple enough that we just need to handle double-quote wrapping.
 */
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
          i++; // skip escaped quote
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

// --- Name splitting ---

/**
 * Given an invite name like "Braxton & Emily Bonds", split into
 * individual guests. Handles these patterns:
 *
 * "Braxton & Emily Bonds"     -> [{Braxton, Bonds}, {Emily, Bonds}]
 * "Vijay Rajkumar"            -> [{Vijay, Rajkumar}]
 * "Huncke Family"             -> [{Huncke, Family}] (family treated as unit)
 * "The Moore Family"          -> [{Moore, Family}]
 * "Phillip, Rhonda & Macy Li Kemp" -> [{Phillip, Kemp}, {Rhonda, Kemp}, {Macy Li, Kemp}]
 * "Martha Lugo & José Vázquez" -> [{Martha, Lugo}, {José, Vázquez}]
 */
function splitNames(
  inviteName: string
): { firstName: string; lastName: string }[] {
  const cleaned = inviteName.trim();

  // "The X Family" pattern
  const familyMatch = cleaned.match(/^(?:The\s+)?(\w+)\s+Family$/i);
  if (familyMatch) {
    return [{ firstName: familyMatch[1], lastName: "Family" }];
  }

  // Split on " & " or ", " to get name parts
  // "Phillip, Rhonda & Macy Li Kemp" -> ["Phillip", "Rhonda", "Macy Li Kemp"]
  const parts = cleaned.split(/\s*&\s*|\s*,\s*/);

  if (parts.length === 1) {
    // Single person: "Vijay Rajkumar"
    const words = parts[0].trim().split(/\s+/);
    if (words.length === 1) {
      return [{ firstName: words[0], lastName: "" }];
    }
    return [{ firstName: words.slice(0, -1).join(" "), lastName: words[words.length - 1] }];
  }

  // Multiple people. The last part has the shared last name.
  // "Braxton" & "Emily Bonds" -> last name is Bonds
  // "Martha Lugo" & "José Vázquez" -> each has their own last name
  const lastPart = parts[parts.length - 1].trim();
  const lastPartWords = lastPart.split(/\s+/);
  const sharedLastName = lastPartWords[lastPartWords.length - 1];

  const guests: { firstName: string; lastName: string }[] = [];

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i].trim();
    const words = part.split(/\s+/);

    if (i === parts.length - 1) {
      // Last person: everything except last word is first name
      if (words.length === 1) {
        guests.push({ firstName: words[0], lastName: sharedLastName });
      } else {
        guests.push({
          firstName: words.slice(0, -1).join(" "),
          lastName: words[words.length - 1],
        });
      }
    } else {
      // Earlier person: if they have 2+ words, they have their own last name
      // "Martha Lugo" has her own. "Braxton" shares the last person's.
      if (words.length >= 2) {
        guests.push({
          firstName: words.slice(0, -1).join(" "),
          lastName: words[words.length - 1],
        });
      } else {
        guests.push({ firstName: words[0], lastName: sharedLastName });
      }
    }
  }

  return guests;
}

// --- Address cleaning ---

const JUNK_ADDRESSES = ["add", "need to add address", ""];

function cleanAddress(addr: string): string {
  if (JUNK_ADDRESSES.includes(addr.toLowerCase().trim())) return "";
  return addr.trim();
}

function cleanCity(city: string): string {
  if (city === "?") return "";
  return city.trim();
}

// --- Main ---

function main() {
  const csvPath = join(__dirname, "..", "invite-addresses.csv");
  const raw = readFileSync(csvPath, "utf-8");
  const rows = parseCSV(raw) as unknown as RawRow[];

  console.log(`Read ${rows.length} rows from CSV`);

  const parties: ParsedParty[] = [];
  const guests: ParsedGuest[] = [];
  const warnings: string[] = [];

  for (const row of rows) {
    const inviteName = row["Name(s)"];
    if (!inviteName) {
      warnings.push(`Skipping row with empty name`);
      continue;
    }

    const countRaw = row.Count;
    // The "Total Count" column in row 2 has a long note instead of a number.
    // The "Count" column is what we want for party_size.
    const partySize = parseInt(countRaw, 10);
    if (isNaN(partySize) || partySize < 1) {
      warnings.push(`"${inviteName}": invalid count "${countRaw}", defaulting to 1`);
    }
    const size = isNaN(partySize) || partySize < 1 ? 1 : partySize;

    const party: ParsedParty = {
      invite_name: inviteName,
      party_size: size,
      address_line_1: cleanAddress(row.Address || ""),
      address_line_2: cleanAddress(row["Address 2"] || ""),
      city: cleanCity(row.City || ""),
      state: (row.State || "").trim(),
      zip_code: (row["Zip Code"] || "").trim(),
      phone: (row.phone || "").trim(),
      email: (row.email || "").trim(),
      source_tag: (row.stage || "").trim(),
      notes: (row.Notes || "").trim(),
      hidden_from_search: false,
    };

    parties.push(party);

    // Split names into individual guests
    const namedGuests = splitNames(inviteName);

    for (const ng of namedGuests) {
      guests.push({
        party_invite_name: inviteName,
        first_name: ng.firstName,
        last_name: ng.lastName,
        is_placeholder: false,
      });
    }

    // Create placeholder guests if count > named guests
    const placeholderCount = size - namedGuests.length;
    if (placeholderCount > 0) {
      const primaryName = namedGuests[0]
        ? `${namedGuests[0].firstName} ${namedGuests[0].lastName}`.trim()
        : inviteName;

      for (let i = 0; i < placeholderCount; i++) {
        const label =
          placeholderCount === 1
            ? `Guest of ${primaryName}`
            : `Guest ${i + 1} of ${primaryName}`;
        guests.push({
          party_invite_name: inviteName,
          first_name: label,
          last_name: "",
          is_placeholder: true,
        });
      }
    }

    if (namedGuests.length > size) {
      warnings.push(
        `"${inviteName}": ${namedGuests.length} named guests but count is ${size}`
      );
    }
  }

  // Write output CSVs
  const partiesCSV = [
    "invite_name,party_size,address_line_1,address_line_2,city,state,zip_code,phone,email,source_tag,hidden_from_search,notes",
    ...parties.map((p) =>
      [
        quote(p.invite_name),
        p.party_size,
        quote(p.address_line_1),
        quote(p.address_line_2),
        quote(p.city),
        quote(p.state),
        quote(p.zip_code),
        quote(p.phone),
        quote(p.email),
        quote(p.source_tag),
        p.hidden_from_search,
        quote(p.notes),
      ].join(",")
    ),
  ].join("\n");

  const guestsCSV = [
    "party_invite_name,first_name,last_name,is_placeholder",
    ...guests.map((g) =>
      [
        quote(g.party_invite_name),
        quote(g.first_name),
        quote(g.last_name),
        g.is_placeholder,
      ].join(",")
    ),
  ].join("\n");

  const outDir = join(__dirname);
  writeFileSync(join(outDir, "parsed_parties_preview.csv"), partiesCSV);
  writeFileSync(join(outDir, "parsed_guests_preview.csv"), guestsCSV);

  console.log(`\nOutput:`);
  console.log(`  ${parties.length} parties -> scripts/parsed_parties_preview.csv`);
  console.log(`  ${guests.length} guests  -> scripts/parsed_guests_preview.csv`);

  if (warnings.length > 0) {
    console.log(`\nWarnings (${warnings.length}):`);
    for (const w of warnings) {
      console.log(`  - ${w}`);
    }
  }

  console.log(`\nReview both CSVs before running load-guests.ts.`);
}

function quote(s: string): string {
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

main();
