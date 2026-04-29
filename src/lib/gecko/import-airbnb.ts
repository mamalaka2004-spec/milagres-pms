import { createAdminClient } from "@/lib/supabase/admin";
import type { GeckoListing } from "./types";

export interface ImportInput {
  listing: GeckoListing;
  companyId: string;
  /** Used as the human-readable code (e.g. MIL-AB-12345). Must be unique. */
  code: string;
  /** URL slug (lowercase, hyphens). Must be unique. */
  slug: string;
  /** Optional name override; falls back to listing.name. */
  name?: string;
  /** Default base price in cents — Gecko doesn't return nightly rate, admin sets later. */
  basePriceCents?: number;
}

export interface ImportResult {
  propertyId: string;
  code: string;
  slug: string;
  imagesAttempted: number;
  imagesUploaded: number;
  imagesFailed: number;
  warnings: string[];
  inferred: {
    max_guests?: number;
    bedrooms?: number;
    beds?: number;
    bathrooms?: number;
    type?: string;
  };
}

/** Strip querystring + normalize so two URLs that point to the same Airbnb photo dedupe. */
function imageBaseKey(url: string): string {
  const q = url.indexOf("?");
  return q === -1 ? url : url.slice(0, q);
}

/** Dedup image URLs while preserving order. mainImage is placed first if not already there. */
function dedupImages(images: Array<{ url: string }>, mainUrl?: string | null): string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];
  const push = (raw?: string | null) => {
    if (!raw) return;
    const key = imageBaseKey(raw);
    if (seen.has(key)) return;
    seen.add(key);
    ordered.push(raw);
  };
  push(mainUrl);
  for (const i of images) push(i.url);
  return ordered;
}

const NUMBER_PHRASE = /(\d+)\s+(?:hóspede|hospede|hóspedes|hospedes|quarto|quartos|cama|camas|banheiro|banheiros)/gi;

/** Parse highlights array like ["6 hóspedes","2 quartos","4 camas","2 banheiros"] into structured numbers. */
function parseHighlights(highlights: string[] | undefined): {
  max_guests?: number;
  bedrooms?: number;
  beds?: number;
  bathrooms?: number;
} {
  const out: { max_guests?: number; bedrooms?: number; beds?: number; bathrooms?: number } = {};
  if (!highlights) return out;
  for (const line of highlights) {
    const matches = [...line.matchAll(NUMBER_PHRASE)];
    for (const m of matches) {
      const n = parseInt(m[1], 10);
      const word = m[0].toLowerCase();
      if (Number.isFinite(n)) {
        if (word.includes("hóspede") || word.includes("hospede")) out.max_guests = n;
        else if (word.includes("quarto")) out.bedrooms = n;
        else if (word.includes("cama")) out.beds = n;
        else if (word.includes("banheiro")) out.bathrooms = n;
      }
    }
  }
  return out;
}

/** Map Gecko propertyType string ("Espaço inteiro: casa") to our enum. */
function inferPropertyType(propertyType: string | null | undefined): string | undefined {
  if (!propertyType) return undefined;
  const p = propertyType.toLowerCase();
  if (p.includes("casa")) return "house";
  if (p.includes("apartamento")) return "apartment";
  if (p.includes("villa")) return "villa";
  if (p.includes("estúdio") || p.includes("estudio") || p.includes("studio")) return "studio";
  if (p.includes("chalé") || p.includes("chale") || p.includes("cabana") || p.includes("cabin")) return "cabin";
  if (p.includes("quarto") || p.includes("room")) return "room";
  return "other";
}

/** Get extension from a URL path; defaults to jpg. */
function pickExtension(url: string): string {
  const path = imageBaseKey(url).toLowerCase();
  const dot = path.lastIndexOf(".");
  if (dot === -1) return "jpg";
  const ext = path.slice(dot + 1);
  if (["jpg", "jpeg", "png", "webp"].includes(ext)) return ext === "jpeg" ? "jpg" : ext;
  return "jpg";
}

function contentTypeFor(ext: string): string {
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  return "image/jpeg";
}

export async function importAirbnbToNewProperty(input: ImportInput): Promise<ImportResult> {
  const supabase = createAdminClient();
  const warnings: string[] = [];

  const { listing, companyId, code, slug } = input;
  if (!listing.listingId) throw new Error("Gecko listing missing listingId");

  const inferred = parseHighlights(listing.highlights);
  const inferredType = inferPropertyType(listing.propertyType);

  const max_guests = inferred.max_guests ?? listing.personCapacity ?? 2;
  const bedrooms = inferred.bedrooms ?? 1;
  const beds = inferred.beds ?? 1;
  const bathrooms = inferred.bathrooms ?? 1;

  const propertyName = input.name || listing.name || `Airbnb ${listing.listingId}`;
  const description = listing.description || null;
  const cancellation = listing.cancellationPolicy || null;
  const meta_title = listing.title || propertyName;

  // 1. Insert property (RLS bypassed via admin client)
  const insertPayload = {
    company_id: companyId,
    name: propertyName,
    code,
    slug,
    status: "active" as const,
    type: inferredType ?? null,
    city: listing.city || null,
    state: listing.city ? "AL" : null, // safe assumption for São Miguel — overridable by admin
    country: "BR",
    latitude: listing.latitude,
    longitude: listing.longitude,
    max_guests,
    bedrooms,
    beds,
    bathrooms,
    title: listing.title || null,
    description,
    cancellation_policy: cancellation,
    meta_title,
    meta_description: description ? description.slice(0, 280) : null,
    base_price_cents: input.basePriceCents ?? 0,
    cleaning_fee_cents: 0,
    extra_guest_fee_cents: 0,
    extra_guest_after: 0,
    instant_booking_enabled: false,
    is_featured: false,
    cover_image_url: null,
    airbnb_listing_url: listing.url,
    airbnb_ical_url: null,
    booking_listing_url: null,
    booking_ical_url: null,
    airbnb_last_synced_at: null,
    booking_last_synced_at: null,
    check_in_time: "15:00",
    check_out_time: "11:00",
    min_nights: 1,
    max_nights: 30,
    address: null,
    neighborhood: null,
    zip_code: null,
    subtitle: null,
    short_description: null,
    house_rules: null,
  };

  const { data: created, error: insertErr } = await (supabase.from("properties") as any) // eslint-disable-line @typescript-eslint/no-explicit-any
    .insert(insertPayload)
    .select("id")
    .single();
  if (insertErr) throw new Error(`property insert: ${insertErr.message}`);
  const propertyId = (created as { id: string }).id;

  // 2. Download + upload images
  const urls = dedupImages(listing.image || [], listing.mainImage?.url);
  let uploaded = 0;
  let failed = 0;

  for (let i = 0; i < urls.length; i++) {
    const sourceUrl = urls[i];
    const ext = pickExtension(sourceUrl);
    const ct = contentTypeFor(ext);
    try {
      const imgRes = await fetch(sourceUrl, {
        headers: {
          // Airbnb's CDN is permissive but a UA helps avoid edge cases
          "User-Agent": "MilagresPMS/1.0 (+https://milagreshospedagens.com)",
          Accept: "image/*,*/*;q=0.8",
        },
        cache: "no-store",
      });
      if (!imgRes.ok) {
        warnings.push(`image[${i}] HTTP ${imgRes.status} fetching ${sourceUrl}`);
        failed++;
        continue;
      }
      const buf = new Uint8Array(await imgRes.arrayBuffer());
      const path = `properties/${propertyId}/airbnb-${i.toString().padStart(2, "0")}-${Date.now()}.${ext}`;

      const { error: upErr } = await supabase.storage
        .from("property-images")
        .upload(path, buf, {
          contentType: ct,
          cacheControl: "31536000",
          upsert: false,
        });
      if (upErr) {
        warnings.push(`image[${i}] upload: ${upErr.message}`);
        failed++;
        continue;
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from("property-images").getPublicUrl(path);

      const { error: rowErr } = await (supabase.from("property_images") as any) // eslint-disable-line @typescript-eslint/no-explicit-any
        .insert({
          property_id: propertyId,
          url: publicUrl,
          alt_text: `${propertyName} — Airbnb photo ${i + 1}`,
          sort_order: i,
          is_cover: i === 0,
        });
      if (rowErr) {
        warnings.push(`image[${i}] row: ${rowErr.message}`);
        failed++;
        continue;
      }

      // First successful upload also becomes property.cover_image_url
      if (i === 0) {
        await (supabase.from("properties") as any) // eslint-disable-line @typescript-eslint/no-explicit-any
          .update({ cover_image_url: publicUrl })
          .eq("id", propertyId);
      }

      uploaded++;
    } catch (err) {
      warnings.push(`image[${i}] error: ${err instanceof Error ? err.message : "unknown"}`);
      failed++;
    }
  }

  return {
    propertyId,
    code,
    slug,
    imagesAttempted: urls.length,
    imagesUploaded: uploaded,
    imagesFailed: failed,
    warnings,
    inferred: {
      max_guests,
      bedrooms,
      beds,
      bathrooms,
      type: inferredType,
    },
  };
}
