/**
 * One-shot dev script: import an Airbnb listing into a new Property using
 * cached Gecko response (no API credit consumed).
 *
 * Run: npx tsx scripts/import-airbnb-from-cache.ts <path-to-gecko-response.json> <code> <slug>
 */

import { readFileSync } from "fs";
import { resolve } from "path";
import { config } from "dotenv";

// Load .env.local manually
config({ path: resolve(process.cwd(), ".env.local") });

import { importAirbnbToNewProperty } from "../src/lib/gecko/import-airbnb";
import type { GeckoExtractResponse } from "../src/lib/gecko/types";

async function main() {
  const [, , cachePath, code, slug] = process.argv;
  if (!cachePath || !code || !slug) {
    console.error("Usage: npx tsx scripts/import-airbnb-from-cache.ts <gecko.json> <code> <slug>");
    process.exit(1);
  }

  const raw = readFileSync(resolve(process.cwd(), cachePath), "utf8");
  const parsed = JSON.parse(raw) as GeckoExtractResponse;
  const listing = parsed.data?.data;
  if (!listing || !listing.listingId) {
    console.error("Cached file does not contain a Gecko listing payload");
    process.exit(1);
  }

  // Default Milagres Hospedagens company
  const companyId = "a0000000-0000-0000-0000-000000000001";

  console.log(`Importing "${listing.name}" (id ${listing.listingId}) into company ${companyId}`);
  console.log(`  code=${code}  slug=${slug}`);

  const result = await importAirbnbToNewProperty({
    listing,
    companyId,
    code,
    slug,
    basePriceCents: 0,
  });

  console.log("\n=== RESULT ===");
  console.log(JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error("Import failed:", err);
  process.exit(1);
});
