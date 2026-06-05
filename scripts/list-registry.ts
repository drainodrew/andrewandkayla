/**
 * list-registry.ts - List all registry items from Supabase
 * Run with: npx tsx scripts/list-registry.ts
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

  const { data, error } = await supabase
    .from("registry_items")
    .select("id, name, price_cents, merchant_name, merchant_url, image_url, status, sort_order")
    .order("sort_order");

  if (error) {
    console.error("Error:", error.message);
    process.exit(1);
  }

  console.log(`Found ${data.length} registry items:\n`);
  for (const item of data) {
    console.log(`[${item.sort_order}] ${item.name}`);
    console.log(`    ID: ${item.id}`);
    console.log(`    Price: $${((item.price_cents || 0) / 100).toFixed(2)}`);
    console.log(`    Merchant: ${item.merchant_name || "(none)"}`);
    console.log(`    URL: ${item.merchant_url || "(none)"}`);
    console.log(`    Image: ${item.image_url || "(none)"}`);
    console.log(`    Status: ${item.status}`);
    console.log();
  }
}

main().catch(console.error);
