/**
 * add-amazon-items.ts
 * Add all Amazon wedding registry items to Supabase.
 * All link to the Amazon registry page for address protection.
 * Run with: npx tsx scripts/add-amazon-items.ts
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
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {}
}

loadEnv();

const AMAZON_REGISTRY = "https://www.amazon.com/wedding/share/andrewandkayla4ever";

// New Amazon items NOT already in Supabase registry
const NEW_ITEMS: {
  name: string;
  price_cents: number;
  merchant_name: string;
  description: string | null;
}[] = [
  {
    name: "BISSELL Little Green HydroSteam Multi-Purpose Portable Cleaner",
    price_cents: 19999,
    merchant_name: "Amazon",
    description: "Portable carpet and upholstery cleaner with HydroSteam technology.",
  },
  {
    name: "CORE HOME 44oz Pink Squiggle Handle Glass Pitcher",
    price_cents: 2695,
    merchant_name: "Amazon",
    description: null,
  },
  {
    name: "Thermacell E-ZoneGuard Patio + Rechargeable Mosquito Repeller",
    price_cents: 3897,
    merchant_name: "Amazon",
    description: "Rechargeable mosquito repeller for outdoor entertaining.",
  },
  {
    name: "SMRCAD Egg Holder for Fridge, Automatic Steady Rolling",
    price_cents: 1799,
    merchant_name: "Amazon",
    description: null,
  },
  {
    name: "Expandable Bamboo Can Rack Organizer for Pantry",
    price_cents: 2849,
    merchant_name: "Amazon",
    description: null,
  },
  {
    name: "ClearSpace Pantry Organization and Storage Bins",
    price_cents: 2399,
    merchant_name: "Amazon",
    description: null,
  },
  {
    name: "Vtopmart 4-Pack Large Stackable Kitchen Pantry Storage Bins",
    price_cents: 3704,
    merchant_name: "Amazon",
    description: null,
  },
  {
    name: "mDesign Modern Stackable Plastic Open Front Storage Bins",
    price_cents: 2999,
    merchant_name: "Amazon",
    description: null,
  },
  {
    name: "YUNCANG Glass Storage Jars 6-Pack 37oz",
    price_cents: 2399,
    merchant_name: "Amazon",
    description: null,
  },
  {
    name: "Glass Storage Jars 6-Pack 50oz",
    price_cents: 3299,
    merchant_name: "Amazon",
    description: null,
  },
  {
    name: "HomArtist Square Glass Jars with Bamboo Lids (Multi-size)",
    price_cents: 3698,
    merchant_name: "Amazon",
    description: null,
  },
  {
    name: "HomArtist Square Glass Jars with Bamboo Lids 79 Fl oz",
    price_cents: 3998,
    merchant_name: "Amazon",
    description: null,
  },
  {
    name: "HHMJSM Large Glass Flour and Sugar Containers",
    price_cents: 2589,
    merchant_name: "Amazon",
    description: null,
  },
  {
    name: "D2scrma 115oz Airtight Glass Square Storage Canister",
    price_cents: 2899,
    merchant_name: "Amazon",
    description: null,
  },
  {
    name: "ComSaf 1 Gallon Cookie Jar, Large Glass Jar with Lid",
    price_cents: 3499,
    merchant_name: "Amazon",
    description: null,
  },
  {
    name: "6-Pack 16oz Overnight Oats Containers with Bamboo Lids",
    price_cents: 2599,
    merchant_name: "Amazon",
    description: null,
  },
  {
    name: "Criusia 4-Set Pantry Organizers and Storage with Bamboo Lids",
    price_cents: 4749,
    merchant_name: "Amazon",
    description: null,
  },
  {
    name: "Shark Matrix Plus Robot Vacuum and Mop",
    price_cents: 27999,
    merchant_name: "Amazon",
    description: "Sonic mopping, matrix clean, HEPA bagless self-empty.",
  },
  {
    name: "KitchenAid Citrus Juice Press Squeezer",
    price_cents: 1999,
    merchant_name: "Amazon",
    description: null,
  },
];

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const supabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Get current max sort_order
  const { data: existing } = await supabase
    .from("registry_items")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1);

  let sortOrder = (existing?.[0]?.sort_order ?? 34) + 1;

  console.log(`Starting sort_order at ${sortOrder}\n`);

  let inserted = 0;
  let skipped = 0;

  for (const item of NEW_ITEMS) {
    // Check if already exists by name
    const { data: dup } = await supabase
      .from("registry_items")
      .select("id")
      .ilike("name", `%${item.name.slice(0, 30)}%`)
      .maybeSingle();

    if (dup) {
      console.log(`  Skipped (exists): ${item.name}`);
      skipped++;
      continue;
    }

    const { error } = await supabase.from("registry_items").insert({
      name: item.name,
      description: item.description,
      price_cents: item.price_cents,
      merchant_name: item.merchant_name,
      merchant_url: AMAZON_REGISTRY,
      image_url: null,
      status: "available",
      sort_order: sortOrder++,
    });

    if (error) {
      console.error(`  FAILED: ${item.name} - ${error.message}`);
    } else {
      console.log(`  Added: ${item.name} ($${(item.price_cents / 100).toFixed(2)})`);
      inserted++;
    }
  }

  console.log(`\nDone: ${inserted} added, ${skipped} skipped.`);
  console.log("All items link to Amazon registry for address protection.");
}

main().catch(console.error);
