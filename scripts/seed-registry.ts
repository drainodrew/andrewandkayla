/**
 * seed-registry.ts
 *
 * Seeds the registry_items table with test items.
 * Run with: npx tsx scripts/seed-registry.ts
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
  } catch {
    // env vars may be set another way
  }
}

loadEnv();

const items = [
  {
    name: "Large 21 oz. Working Glass with Lid",
    description:
      "The everyday glass. Great for iced coffee, smoothies, or just water. Comes with a lid for on the go.",
    price_cents: 1395,
    merchant_name: "Crate & Barrel",
    merchant_url:
      "https://www.crateandbarrel.com/large-21-oz.-working-glass-with-lid/s485145",
    image_url: "/images/registry/working-glass.jpg",
    status: "available",
    sort_order: 1,
  },
  {
    name: "Atwell 16 oz. Stackable Ribbed Highball Glass",
    description:
      "Beautiful ribbed texture, stackable for easy storage. Perfect for cocktails or sparkling water.",
    price_cents: 895,
    merchant_name: "Crate & Barrel",
    merchant_url:
      "https://www.crateandbarrel.com/atwell-16-oz.-stackable-ribbed-highball-glass/s202062",
    image_url: "/images/registry/atwell-highball.jpg",
    status: "available",
    sort_order: 2,
  },
  {
    name: "Eight Sleep Pod 5",
    description:
      "The smart mattress cover that heats, cools, and tracks your sleep. We are obsessed with ours and would love an upgrade to the Pod 5.",
    price_cents: 284900,
    merchant_name: "Eight Sleep",
    merchant_url: "https://www.eightsleep.com/product/the-cover/",
    image_url: "/images/registry/eight-sleep-pod5.png",
    status: "available",
    sort_order: 3,
  },
  {
    name: "Honeymoon Fund",
    description:
      "Help us make some memories. We're planning a trip after the wedding and any contribution means the world to us.",
    price_cents: 0,
    merchant_name: null,
    merchant_url: null,
    image_url: null,
    status: "available",
    sort_order: 4,
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

  // Check for existing items to avoid duplicates
  const { data: existing } = await supabase
    .from("registry_items")
    .select("name");
  const existingNames = new Set((existing || []).map((r) => r.name));

  for (const item of items) {
    if (existingNames.has(item.name)) {
      console.log(`Skipped (already exists): ${item.name}`);
      continue;
    }

    const { error } = await supabase.from("registry_items").insert(item);

    if (error) {
      console.error(`Failed to insert "${item.name}":`, error.message);
    } else {
      console.log(`Inserted: ${item.name}`);
    }
  }

  console.log("\nDone.");
}

main().catch(console.error);
