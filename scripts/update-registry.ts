/**
 * update-registry.ts - Remove and update registry items
 * Run with: npx tsx scripts/update-registry.ts
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

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const supabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // ============================================================
  // 1. DELETE items
  // ============================================================
  const toDelete = [
    { id: "5bb1831e-0f95-4bbc-918b-6cf4026b3af4", name: "Le Creuset round dutch oven 7.25 qt" },
    { id: "511f3624-c7d9-4e37-a973-36023c3dd3d6", name: "Brumate cooler" },
    { id: "9913f753-fa7e-40ab-836d-e77a6b4bd143", name: "Yeti cooler (teal)" },
    { id: "e80d4bfb-e039-401c-90c5-c94ae3acd110", name: "Apple AirTags" },
    { id: "3bdb9425-2372-4ae7-8f48-1805f558329a", name: "Hestan baking sheets set (2pc)" },
  ];

  console.log("=== DELETING ITEMS ===\n");
  for (const item of toDelete) {
    // First delete any claim events referencing this item
    await supabase
      .from("registry_claim_events")
      .delete()
      .eq("registry_item_id", item.id);

    // Then delete any RSVPs/claims
    const { error } = await supabase
      .from("registry_items")
      .delete()
      .eq("id", item.id);

    if (error) {
      console.error(`  FAILED to delete "${item.name}": ${error.message}`);
    } else {
      console.log(`  Deleted: ${item.name}`);
    }
  }

  // ============================================================
  // 2. UPDATE items
  // ============================================================
  console.log("\n=== UPDATING ITEMS ===\n");

  const updates: { id: string; name: string; changes: Record<string, unknown> }[] = [
    // Popcorn maker: update link to Williams Sonoma
    {
      id: "fd978aae-bb82-47ee-ae51-42e2135da57b",
      name: "Easy Pop popcorn maker",
      changes: {
        merchant_name: "Williams Sonoma",
        merchant_url: "https://www.williams-sonoma.com/products/open-kitchen-by-williams-sonoma-hot-air-popcorn-maker/",
      },
    },
    // Away suitcase: price -> $375
    {
      id: "2da9e77d-5d5b-42b0-9c3e-01e1a82a1011",
      name: "Large Away suitcase",
      changes: {
        price_cents: 37500,
      },
    },
    // Costco Robot Vacuum: add the existing image
    {
      id: "4f31f878-fb40-4c94-abb3-118dc2f90c39",
      name: "Costco Robot Vacuum",
      changes: {
        image_url: "/images/registry/costco-robot-vaccum.webp",
      },
    },
    // Le Creuset casserole dish (Cream): update to foret color
    {
      id: "b6f671ab-c1b5-4a5e-b1da-5e65c583e7d5",
      name: "Le Creuset casserole dish (Cream)",
      changes: {
        name: "Le Creuset casserole dish (Foret)",
      },
    },
    // Hestan bakeware 7pc: needs photo (leaving note, no image provided yet)
    {
      id: "8ae7f6ca-15e8-4487-8b94-b373faf1f3db",
      name: "Hestan bakeware sheets set of 7",
      changes: {},
    },
    // YETI Hopper M20 Backpack Cooler: fix link
    {
      id: "cb93a726-93da-4f07-956a-f38062c427a6",
      name: "Yeti Hopper M20 Backpack Cooler",
      changes: {
        merchant_url: "https://www.yeti.com/coolers/soft-coolers/hopper-m20-backpack-soft-cooler/18060131609.html",
      },
    },
  ];

  for (const item of updates) {
    if (Object.keys(item.changes).length === 0) {
      console.log(`  Skipped (no changes yet): ${item.name}`);
      continue;
    }

    const { error } = await supabase
      .from("registry_items")
      .update(item.changes)
      .eq("id", item.id);

    if (error) {
      console.error(`  FAILED to update "${item.name}": ${error.message}`);
    } else {
      console.log(`  Updated: ${item.name} -> ${JSON.stringify(item.changes)}`);
    }
  }

  console.log("\n=== DONE ===");
  console.log("\nStill needs from Andrew/Kayla:");
  console.log("  - New photo for Le Creuset casserole dish (foret color)");
  console.log("  - New photo for Le Creuset 3-set casserole dishes (foret color)");
  console.log("  - New photo for Hestan baking dish 7pc");
  console.log("  - Different Pod 5 description (what should it say?)");
}

main().catch(console.error);
