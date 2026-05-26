/**
 * import-registry.ts
 *
 * Parses wedding_registry_items.csv, downloads product images from
 * merchant URLs (using OG image tags), and seeds them into Supabase.
 *
 * Run with: npx tsx scripts/import-registry.ts
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join, extname } from "path";
import { createClient } from "@supabase/supabase-js";
import https from "https";
import http from "http";

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

const REGISTRY_DIR = join(__dirname, "..", "public", "images", "registry");

interface CsvRow {
  name: string;
  price: string;
  link: string;
}

function parseCsv(filepath: string): CsvRow[] {
  const content = readFileSync(filepath, "utf-8");
  const lines = content.trim().split("\n");
  // Skip header
  return lines.slice(1).map((line) => {
    // Handle commas inside quoted fields
    const parts: string[] = [];
    let current = "";
    let inQuotes = false;
    for (const ch of line) {
      if (ch === '"') {
        inQuotes = !inQuotes;
      } else if (ch === "," && !inQuotes) {
        parts.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
    parts.push(current.trim());
    return {
      name: parts[0] || "",
      price: parts[1] || "",
      link: parts[2] || "",
    };
  });
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function parsePriceCents(price: string): number | null {
  if (!price) return null;
  const cleaned = price.replace(/[^0-9.]/g, "");
  if (!cleaned) return null;
  return Math.round(parseFloat(cleaned) * 100);
}

function getMerchantName(url: string): string | null {
  if (!url) return null;
  try {
    const hostname = new URL(url).hostname.replace("www.", "");
    const nameMap: Record<string, string> = {
      "a.co": "Amazon",
      "amazon.com": "Amazon",
      "birchlane.com": "Birch Lane",
      "awaytravel.com": "Away",
      "pin.it": "Pinterest",
      "pinterest.com": "Pinterest",
      "brumate.com": "BruMate",
      "yeti.com": "YETI",
      "target.com": "Target",
      "costco.com": "Costco",
      "shun.kaiusa.com": "Shun Cutlery",
      "crateandbarrel.com": "Crate & Barrel",
      "williams-sonoma.com": "Williams Sonoma",
      "finexusa.com": "FINEX",
      "surlatable.com": "Sur La Table",
      "homedepot.com": "The Home Depot",
      "eightsleep.com": "Eight Sleep",
    };
    return nameMap[hostname] || hostname;
  } catch {
    return null;
  }
}

function fetchUrl(url: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const client = url.startsWith("https") ? https : http;
    const req = client.get(url, { headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" } }, (res) => {
      // Follow redirects
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        let redirectUrl = res.headers.location;
        if (redirectUrl.startsWith("/")) {
          const parsed = new URL(url);
          redirectUrl = `${parsed.protocol}//${parsed.host}${redirectUrl}`;
        }
        fetchUrl(redirectUrl).then(resolve).catch(reject);
        return;
      }
      const chunks: Buffer[] = [];
      res.on("data", (chunk: Buffer) => chunks.push(chunk));
      res.on("end", () => resolve(Buffer.concat(chunks)));
      res.on("error", reject);
    });
    req.on("error", reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error("timeout")); });
  });
}

async function extractOgImage(pageUrl: string): Promise<string | null> {
  if (!pageUrl) return null;
  try {
    const html = (await fetchUrl(pageUrl)).toString("utf-8");
    // Try og:image first
    const ogMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i)
      || html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i);
    if (ogMatch) return ogMatch[1];

    // Try twitter:image
    const twMatch = html.match(/<meta[^>]*name=["']twitter:image["'][^>]*content=["']([^"']+)["']/i)
      || html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*name=["']twitter:image["']/i);
    if (twMatch) return twMatch[1];

    // Try first large product image
    const imgMatch = html.match(/<img[^>]*src=["']([^"']+(?:product|hero|main|primary)[^"']*\.(?:jpg|jpeg|png|webp))["']/i);
    if (imgMatch) return imgMatch[1];

    return null;
  } catch (err) {
    console.warn(`  Could not fetch page: ${pageUrl} - ${err}`);
    return null;
  }
}

async function downloadImage(imageUrl: string, slug: string): Promise<string | null> {
  try {
    // Determine extension from URL
    let ext = ".jpg";
    const urlPath = new URL(imageUrl).pathname;
    const urlExt = extname(urlPath).toLowerCase().split("?")[0];
    if ([".jpg", ".jpeg", ".png", ".webp"].includes(urlExt)) {
      ext = urlExt;
    }

    const filename = `${slug}${ext}`;
    const filepath = join(REGISTRY_DIR, filename);

    if (existsSync(filepath)) {
      console.log(`  Image already exists: ${filename}`);
      return `/images/registry/${filename}`;
    }

    const buffer = await fetchUrl(imageUrl);
    if (buffer.length < 1000) {
      console.warn(`  Image too small (${buffer.length} bytes), skipping`);
      return null;
    }
    writeFileSync(filepath, buffer);
    console.log(`  Downloaded: ${filename} (${Math.round(buffer.length / 1024)}KB)`);
    return `/images/registry/${filename}`;
  } catch (err) {
    console.warn(`  Failed to download image: ${err}`);
    return null;
  }
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  if (!url || !key) {
    console.error("Missing Supabase env vars.");
    process.exit(1);
  }

  if (!existsSync(REGISTRY_DIR)) {
    mkdirSync(REGISTRY_DIR, { recursive: true });
  }

  const supabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const csvPath = join(__dirname, "wedding_registry_items.csv");
  const rows = parseCsv(csvPath);
  console.log(`Parsed ${rows.length} items from CSV.\n`);

  // Get existing items to find next sort_order and avoid duplicates
  const { data: existing } = await supabase
    .from("registry_items")
    .select("name, sort_order")
    .order("sort_order", { ascending: false })
    .limit(1);

  const startOrder = (existing?.[0]?.sort_order || 0) + 1;

  const { data: allExisting } = await supabase
    .from("registry_items")
    .select("name");
  const existingNames = new Set((allExisting || []).map((r) => r.name));

  let order = startOrder;
  for (const row of rows) {
    if (!row.name) continue;

    // Skip "Individual honeymoon excursion" as it's like the existing honeymoon fund
    if (row.name.toLowerCase().includes("honeymoon")) {
      console.log(`Skipping honeymoon item (already have Honeymoon Fund): ${row.name}`);
      continue;
    }

    if (existingNames.has(row.name)) {
      console.log(`Skipped (already exists): ${row.name}`);
      continue;
    }

    console.log(`Processing: ${row.name}`);
    const slug = slugify(row.name);

    // Try to download product image
    let imageUrl: string | null = null;
    if (row.link) {
      const ogImage = await extractOgImage(row.link);
      if (ogImage) {
        imageUrl = await downloadImage(ogImage, slug);
      } else {
        console.log("  No OG image found");
      }
    }

    const item = {
      name: row.name,
      description: null,
      price_cents: parsePriceCents(row.price),
      merchant_name: getMerchantName(row.link),
      merchant_url: row.link || null,
      image_url: imageUrl,
      status: "available",
      sort_order: order++,
    };

    const { error } = await supabase.from("registry_items").insert(item);
    if (error) {
      console.error(`  Failed to insert: ${error.message}`);
    } else {
      console.log(`  Inserted into DB (sort_order: ${item.sort_order})`);
    }
  }

  console.log("\nDone.");
}

main().catch(console.error);
