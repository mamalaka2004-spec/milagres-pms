#!/usr/bin/env node
/**
 * One-off: upload the 7 "Guia de Boas-Vindas" PDFs to the private `property-guides`
 * bucket and set property_guides.pdf_path for each unit.
 *
 * Prereqs: migration 011 (bucket) + 012 (units) already applied.
 * Run from the project root:  node scripts/upload-guides.mjs
 * Reads NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY from .env.local
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const GUIDES_DIR = path.resolve(ROOT, "../boas vindas imoveis milagres");

// filename substring -> unit_code (must match seed 012)
const MAP = [
  ["COTINGUIBA 08", "cotinguiba-08"],
  ["Duplex", "duplex-kanui-116"],
  ["Kanui201", "kanui-201"],
  ["Kanui206", "kanui-206"],
  ["Tamoná07", "tamona-07"],
  ["Tamoná18", "tamona-18"],
  ["Villa Green", "villa-green"],
];

function loadEnv() {
  const envPath = path.join(ROOT, ".env.local");
  const txt = fs.readFileSync(envPath, "utf8");
  const env = {};
  for (const line of txt.split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return env;
}

async function main() {
  const env = loadEnv();
  const URL = env.NEXT_PUBLIC_SUPABASE_URL;
  const KEY = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!URL || !KEY) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env.local");

  const files = fs.readdirSync(GUIDES_DIR).filter((f) => f.toLowerCase().endsWith(".pdf"));

  for (const [needle, unitCode] of MAP) {
    const file = files.find((f) => f.includes(needle));
    if (!file) {
      console.error(`SKIP ${unitCode}: no PDF matching "${needle}"`);
      continue;
    }
    const buf = fs.readFileSync(path.join(GUIDES_DIR, file));
    const objectPath = `${unitCode}.pdf`;

    // Upload (upsert) to the private bucket.
    const up = await fetch(`${URL}/storage/v1/object/property-guides/${encodeURIComponent(objectPath)}`, {
      method: "POST",
      headers: {
        apikey: KEY,
        Authorization: `Bearer ${KEY}`,
        "Content-Type": "application/pdf",
        "x-upsert": "true",
      },
      body: buf,
    });
    if (!up.ok) {
      console.error(`FAIL upload ${unitCode}: HTTP ${up.status} ${(await up.text()).slice(0, 200)}`);
      continue;
    }

    // Set pdf_path on the matching guide row.
    const patch = await fetch(
      `${URL}/rest/v1/property_guides?unit_code=eq.${unitCode}`,
      {
        method: "PATCH",
        headers: {
          apikey: KEY,
          Authorization: `Bearer ${KEY}`,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify({ pdf_path: objectPath }),
      }
    );
    if (!patch.ok) {
      console.error(`uploaded but FAILED to set pdf_path ${unitCode}: HTTP ${patch.status} ${(await patch.text()).slice(0, 200)}`);
      continue;
    }
    console.log(`OK ${unitCode}  <-  ${file}  (${(buf.length / 1048576).toFixed(1)} MB)`);
  }
  console.log("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
