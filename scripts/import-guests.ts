/**
 * import-guests.ts
 *
 * Reads the updated wedding mailing list CSV and outputs clean,
 * reviewable CSVs for human review before loading to Supabase.
 *
 * Run with: npx tsx scripts/import-guests.ts
 *
 * What this script does:
 * 1. Parses the GHL export CSV (quoted fields, extra columns)
 * 2. Expands families using known member lists
 * 3. Splits "Name1 & Name2" couples into individual guests
 * 4. Skips non-guest rows (e.g. Belle Meade Mansion)
 * 5. Flags families where we're still awaiting member names
 * 6. Outputs two CSVs:
 *    - parsed_parties_preview.csv  (one row per party)
 *    - parsed_guests_preview.csv   (one row per guest)
 *
 * Does NOT touch the database. That's load-guests.ts (session 2).
 */

import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

// --- Types ---

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

// --- Name overrides ---
// Families where the CSV just says "The X Family" but we know who's in it,
// and names where the generic splitter gets it wrong (e.g. multi-word
// surnames like "Zambrano Zambrano").
// Entries marked AWAITING have placeholder members that need to be filled in.

const NAME_OVERRIDES: Record<
  string,
  { firstName: string; lastName: string }[]
> = {
  "The Huncke Family": [
    { firstName: "Kevan", lastName: "Huncke" },
    { firstName: "Dan", lastName: "Huncke" },
    { firstName: "Carson", lastName: "Huncke" },
  ],
  "The Wegner Family": [
    { firstName: "Dean", lastName: "Wegner" },
    { firstName: "Kelly", lastName: "Wegner" },
    { firstName: "Kara", lastName: "Wegner" },
    { firstName: "Dylan", lastName: "Wegner" },
    { firstName: "Eskel", lastName: "Wegner" },
  ],
  "The Moore Family": [
    { firstName: "Joe", lastName: "Moore" },
    { firstName: "Julia", lastName: "Moore" },
    { firstName: "Ellery", lastName: "Brewbaker" },
    { firstName: "Tom", lastName: "Brewbaker" },
    { firstName: "Matthew", lastName: "Moore" },
    { firstName: "Mary", lastName: "Moore" },
    { firstName: "Keagan", lastName: "Moore" },
    { firstName: "Madelyn", lastName: "Moore" },
  ],
  "The McGuire Family": [
    { firstName: "Annie", lastName: "McGuire" },
    { firstName: "Megan", lastName: "McGuire" },
    { firstName: "Tommy", lastName: "McGuire" },
    { firstName: "Jeff", lastName: "McGuire" },
    { firstName: "Tracy", lastName: "McGuire" },
  ],
  "The Schenkel Family": [
    { firstName: "Kendra", lastName: "Schenkel" },
    { firstName: "Dave", lastName: "Schenkel" },
    { firstName: "Luke", lastName: "Schenkel" },
    { firstName: "AnnaClaire", lastName: "Schenkel" },
  ],
  "The Meyer Family": [
    { firstName: "Nick", lastName: "Meyer" },
    { firstName: "Karen", lastName: "Meyer" },
    { firstName: "Sonia", lastName: "Meyer" },
    { firstName: "Ellie", lastName: "Meyer" },
    { firstName: "Nina", lastName: "Meyer" },
  ],
  // Tina & Tony's kids are part of their party
  "Tina & Tony Myers": [
    { firstName: "Tina", lastName: "Myers" },
    { firstName: "Tony", lastName: "Myers" },
    { firstName: "Knox", lastName: "Myers" },
    { firstName: "Emmylayne", lastName: "Myers" },
  ],
  // Venezuelan double surname; generic splitter can't handle this
  "Victor Zambrano Zambrano": [
    { firstName: "Victor", lastName: "Zambrano Zambrano" },
  ],
  "David & Kimberly Zambrano Zambrano": [
    { firstName: "David", lastName: "Zambrano Zambrano" },
    { firstName: "Kimberly", lastName: "Zambrano Zambrano" },
  ],
};

// Rows to skip entirely (not guests)
const SKIP_NAMES = new Set(["Belle Meade Mansion"]);

// --- CSV parsing ---

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

// --- Name splitting ---

/**
 * Split an invite name into individual guests.
 *
 * Handles:
 *   "Braxton & Emily Bonds"          -> [{Braxton, Bonds}, {Emily, Bonds}]
 *   "Martha Lugo & José Vázquez"     -> [{Martha, Lugo}, {José, Vázquez}]
 *   "Sarah Taylor and Joshua Gobble" -> [{Sarah, Taylor}, {Joshua, Gobble}]
 *   "Vijay Rajkumar"                 -> [{Vijay, Rajkumar}]
 *   "Phillip, Rhonda & Macy Li Kemp" -> [{Phillip, Kemp}, {Rhonda, Kemp}, {Macy Li, Kemp}]
 *   "Ruby Monette-Meadow"            -> [{Ruby, Monette-Meadow}]
 *   "Brian O'Boyle"                  -> [{Brian, O'Boyle}]
 */
function splitNames(
  inviteName: string
): { firstName: string; lastName: string }[] {
  const cleaned = inviteName.trim();

  // Split on " & ", " and ", or ", " to get name parts
  const parts = cleaned.split(/\s+(?:&|and)\s+|\s*,\s*/);

  if (parts.length === 1) {
    // Single person
    const words = parts[0].trim().split(/\s+/);
    if (words.length === 1) {
      return [{ firstName: words[0], lastName: "" }];
    }
    return [
      {
        firstName: words.slice(0, -1).join(" "),
        lastName: words[words.length - 1],
      },
    ];
  }

  // Multiple people. The last part has the shared last name.
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
      // Earlier person: 2+ words means they have their own last name
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

// --- Main ---

function main() {
  const csvPath = join(
    __dirname,
    "Updated_Wedding_Mailing_List_rehearsal - final-wedding-mail-list.csv"
  );
  const raw = readFileSync(csvPath, "utf-8");
  const rows = parseCSV(raw);

  console.log(`Read ${rows.length} rows from CSV`);

  const parties: ParsedParty[] = [];
  const guests: ParsedGuest[] = [];
  const warnings: string[] = [];

  for (const row of rows) {
    const inviteName = (row["Name(s)"] || "").trim();
    if (!inviteName) {
      warnings.push("Skipping row with empty name");
      continue;
    }

    if (SKIP_NAMES.has(inviteName)) {
      console.log(`  Skipping non-guest row: "${inviteName}"`);
      continue;
    }

    // Determine individual guests for this party
    let partyGuests: { firstName: string; lastName: string }[];

    if (NAME_OVERRIDES[inviteName] !== undefined) {
      const members = NAME_OVERRIDES[inviteName];
      if (members.length === 0) {
        warnings.push(
          `AWAITING NAMES: "${inviteName}" has no members listed yet. ` +
            `Add names to NAME_OVERRIDES in import-guests.ts.`
        );
        // Create a single placeholder so the party still appears
        partyGuests = [];
      } else {
        partyGuests = members;
      }
    } else {
      partyGuests = splitNames(inviteName);
    }

    // Parse address. The new CSV has separate City and State columns.
    const addressRaw = (row["Address"] || "").trim();
    const city = (row["City"] || "").trim();
    const state = (row["State"] || "").trim();
    const zip = (row["Zip Code"] || "").trim();
    const phone = (row["phone"] || "").trim();
    const email = (row["email"] || "").trim();
    const stage = (row["stage"] || "").trim();

    const partySize = Math.max(partyGuests.length, 1);

    const party: ParsedParty = {
      invite_name: inviteName,
      party_size: partySize,
      address_line_1: addressRaw,
      address_line_2: "",
      city,
      state,
      zip_code: zip,
      phone,
      email,
      source_tag: stage,
      notes: "",
      hidden_from_search: false,
    };

    parties.push(party);

    if (partyGuests.length === 0) {
      // Family with no members yet, create placeholder
      guests.push({
        party_invite_name: inviteName,
        first_name: `[AWAITING] ${inviteName}`,
        last_name: "",
        is_placeholder: true,
      });
    } else {
      for (const g of partyGuests) {
        guests.push({
          party_invite_name: inviteName,
          first_name: g.firstName,
          last_name: g.lastName,
          is_placeholder: false,
        });
      }
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
  console.log(
    `  ${parties.length} parties -> scripts/parsed_parties_preview.csv`
  );
  console.log(
    `  ${guests.length} guests  -> scripts/parsed_guests_preview.csv`
  );

  if (warnings.length > 0) {
    console.log(`\n⚠ Warnings (${warnings.length}):`);
    for (const w of warnings) {
      console.log(`  - ${w}`);
    }
  }

  console.log("\nAll families resolved. Ready to load.");
  console.log(`\nReview both CSVs before running load-guests.ts.`);
}

function quote(s: string): string {
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

main();
