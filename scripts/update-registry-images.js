/**
 * Update registry_items image_url in Supabase for newly downloaded images.
 * Run: node scripts/update-registry-images.js
 *
 * Only updates items where image_url is currently null and we have
 * a downloaded image file on disk.
 */

const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Map: registry_items.id -> local image path (relative to /public)
// These are the items we successfully downloaded images for.
const updates = [
  {
    id: "c71f8c0d-a224-4105-aa0e-94e15b2f8504",
    name: "Ninja creami containers",
    image_url: "/images/registry/ninja-creami-containers.jpg",
  },
  {
    id: "1a29a161-40cd-49bd-a90c-8f3d618faf68",
    name: "Cute little water pitcher",
    image_url: "/images/registry/water-pitcher.jpg",
  },
  {
    id: "511f3624-c7d9-4e37-a973-36023c3dd3d6",
    name: "Brumate cooler",
    image_url: "/images/registry/brumate-cooler.jpg",
  },
  {
    id: "46f60f8d-dd9c-4dae-bf89-2b9a1bac695d",
    name: "Wine rack",
    image_url: "/images/registry/wine-rack.jpg",
  },
  {
    id: "6107d178-09ef-496c-848f-3a98cad53c60",
    name: "Mortar and pestle",
    image_url: "/images/registry/mortar-and-pestle.jpg",
  },
  {
    id: "e80d4bfb-e039-401c-90c5-c94ae3acd110",
    name: "Apple AirTags",
    image_url: "/images/registry/apple-airtags.jpg",
  },
  {
    id: "ce8b1430-fb1d-4e1d-823e-e902bc23dfbd",
    name: "Dewalt Charging Station",
    image_url: "/images/registry/dewalt-charging-station.jpg",
  },
  {
    id: "7425f4e3-ea92-4b77-bd48-ed64261168be",
    name: "Dewalt Battery",
    image_url: "/images/registry/dewalt-battery.jpg",
  },
  {
    id: "8f40c827-233e-41d9-9573-1a1511743c0f",
    name: "Reusable silicone paint liner with metal tray",
    image_url: "/images/registry/silicone-paint-liner.jpg",
  },
];

async function main() {
  const registryDir = path.join(__dirname, "..", "public", "images", "registry");

  let successCount = 0;
  let skipCount = 0;
  let errorCount = 0;

  for (const item of updates) {
    // Verify the image file exists on disk
    const localPath = path.join(registryDir, path.basename(item.image_url));
    if (!fs.existsSync(localPath)) {
      console.log(`SKIP: ${item.name} - file not found at ${localPath}`);
      skipCount++;
      continue;
    }

    const { error } = await supabase
      .from("registry_items")
      .update({ image_url: item.image_url })
      .eq("id", item.id);

    if (error) {
      console.error(`ERROR: ${item.name} - ${error.message}`);
      errorCount++;
    } else {
      console.log(`OK: ${item.name} -> ${item.image_url}`);
      successCount++;
    }
  }

  console.log(
    `\nDone: ${successCount} updated, ${skipCount} skipped, ${errorCount} errors`
  );
}

main().catch(console.error);
