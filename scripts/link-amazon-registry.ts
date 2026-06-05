/**
 * link-amazon-registry.ts
 * Update overlapping registry items to point to the Amazon wedding registry.
 * Run with: npx tsx scripts/link-amazon-registry.ts
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

// Items in Supabase that are also on the Amazon registry
// Update their merchant to Amazon so guests get address protection
const OVERLAP_UPDATES: { id: string; name: string }[] = [
  { id: "c71f8c0d-a224-4105-aa0e-94e15b2f8504", name: "Ninja creami containers" },
  { id: "2b2085a9-ce68-478f-ab84-d8460a29c844", name: "KitchenAid pasta maker attachment" },
  { id: "06c038fb-e7f3-4254-8380-2cfdb05c2f77", name: "Garlic press" },
  { id: "464a58c6-01a2-411f-88b1-e411d3bd2688", name: "Lemon juicer" },
  { id: "009dd126-c4e1-4e84-8468-a9d2ea5290cd", name: "Green pasta bowl" },
  { id: "6107d178-09ef-496c-848f-3a98cad53c60", name: "Mortar and pestle" },
  { id: "46f60f8d-dd9c-4dae-bf89-2b9a1bac695d", name: "Wine rack" },
  { id: "9d256c39-3de1-487c-a125-12da3834b5cb", name: "Shun chef knife" },
  { id: "20eb10cf-aa5e-4efe-8fd9-9f19cdc266c2", name: "Cast iron skillet 14in" },
  { id: "ce8b1430-fb1d-4e1d-823e-e902bc23dfbd", name: "Dewalt Charging Station" },
  { id: "7425f4e3-ea92-4b77-bd48-ed64261168be", name: "Dewalt Battery" },
];

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const supabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log("=== LINKING OVERLAPPING ITEMS TO AMAZON REGISTRY ===\n");

  for (const item of OVERLAP_UPDATES) {
    const { error } = await supabase
      .from("registry_items")
      .update({
        merchant_name: "Amazon",
        merchant_url: AMAZON_REGISTRY,
      })
      .eq("id", item.id);

    if (error) {
      console.error(`  FAILED "${item.name}": ${error.message}`);
    } else {
      console.log(`  Linked: ${item.name} -> Amazon Registry`);
    }
  }

  console.log("\nDone. All overlapping items now link to the Amazon wedding registry.");
}

main().catch(console.error);
