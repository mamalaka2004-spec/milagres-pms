import { createAdminClient } from "@/lib/supabase/admin";
import { extractListings } from "@/lib/gecko/client";
import type { MarketSource } from "@/lib/gecko/types";
import {
  buildSearchUrl,
  computeStats,
  nightsBetween,
  normalizeComp,
  type NormalizedComp,
} from "./analyze";

// Gecko credit cost per PLP page, by source (for reporting).
const CREDITS_PER_PAGE: Record<MarketSource, number> = { airbnb: 1, booking: 5 };

export interface CollectParams {
  propertyId: string;
  source?: MarketSource;
  checkIn: string; // YYYY-MM-DD
  checkOut: string; // YYYY-MM-DD
  pages?: number; // PLP pages to pull (default 1)
  numAdults?: number; // override (defaults to the property's max_guests, capped 16)
}

export interface CollectResult {
  snapshotId: string;
  source: MarketSource;
  sampleSize: number;
  totalResults: number | null;
  radiusKm: number | null;
  suggestedNightly: number | null;
  yourNightly: number | null;
  priceMedian: number | null;
  priceP25: number | null;
  priceP75: number | null;
  creditsUsed: number;
  comps: number;
}

/**
 * Run a market collection for one property: pull competitor listings from Gecko (PLP),
 * normalize, compute the suggested nightly rate, and persist a snapshot + comps.
 * Returns the snapshot summary. Throws on missing property / geo / Gecko error.
 */
export async function collectMarketForProperty(params: CollectParams): Promise<CollectResult> {
  const source: MarketSource = params.source ?? "airbnb";
  const pages = Math.min(Math.max(params.pages ?? 1, 1), 3);
  const supabase = createAdminClient();

  const { data: propRow, error: propErr } = await supabase
    .from("properties")
    .select("id, company_id, name, city, state, latitude, longitude, bedrooms, max_guests, base_price_cents")
    .eq("id", params.propertyId)
    .maybeSingle();
  if (propErr) throw propErr;
  const property = propRow as {
    id: string;
    company_id: string;
    name: string;
    city: string | null;
    state: string | null;
    latitude: number | null;
    longitude: number | null;
    bedrooms: number;
    max_guests: number;
    base_price_cents: number;
  } | null;
  if (!property) throw new Error("Property not found");

  const place = [property.city, property.state, "Brasil"].filter(Boolean).join(", ");
  const searchUrl = buildSearchUrl(source, property.city || place);
  const nights = nightsBetween(params.checkIn, params.checkOut);

  // Pull the requested number of PLP pages, accumulating items + metadata.
  const allComps: NormalizedComp[] = [];
  let totalResults: number | null = null;
  let radiusKm: number | null = null;
  let creditsUsed = 0;

  for (let page = 1; page <= pages; page++) {
    const resp = await extractListings({
      source,
      url: searchUrl,
      page,
      address: place,
      keyword: source === "booking" ? property.city || place : undefined,
      startDate: params.checkIn,
      endDate: params.checkOut,
      numAdults: Math.min(params.numAdults || property.max_guests || 2, 16),
      numRooms: source === "booking" ? 1 : undefined,
      // Gecko only accepts latitude/longitude for Airbnb PLP (Booking rejects them → 400).
      latitude: source === "airbnb" ? property.latitude ?? undefined : undefined,
      longitude: source === "airbnb" ? property.longitude ?? undefined : undefined,
      lang: "pt-br",
      currency: "BRL",
    });
    creditsUsed += CREDITS_PER_PAGE[source];
    const d = resp.data;
    if (totalResults == null) totalResults = d.totalResults ?? null;
    if (radiusKm == null) radiusKm = d.coordinateRadiusKm ?? null;
    for (const item of d.items || []) allComps.push(normalizeComp(item, source, nights));
    if (!d.nextPage) break; // no more pages
  }

  const stats = computeStats(allComps, property.bedrooms ?? null);
  const yourNightly = property.base_price_cents > 0 ? property.base_price_cents / 100 : null;

  // Persist snapshot.
  const { data: snapRow, error: snapErr } = await (supabase.from("market_snapshots") as any) // eslint-disable-line @typescript-eslint/no-explicit-any
    .insert({
      company_id: property.company_id,
      property_id: property.id,
      source,
      check_in: params.checkIn,
      check_out: params.checkOut,
      nights,
      radius_km: radiusKm,
      total_results: totalResults,
      sample_size: stats.sampleSize,
      price_min: stats.priceMin,
      price_p25: stats.priceP25,
      price_median: stats.priceMedian,
      price_p75: stats.priceP75,
      price_max: stats.priceMax,
      suggested_nightly: stats.suggestedNightly,
      your_nightly: yourNightly,
      credits_used: creditsUsed,
      raw_meta: { totalResults, radiusKm, pages, place, searchUrl },
    })
    .select("id")
    .single();
  if (snapErr) throw snapErr;
  const snapshotId = (snapRow as { id: string }).id;

  // Persist comps linked to the snapshot.
  if (allComps.length > 0) {
    const rows = allComps.map((c) => ({
      company_id: property.company_id,
      property_id: property.id,
      snapshot_id: snapshotId,
      source: c.source,
      listing_id: c.listingId,
      url: c.url,
      title: c.title,
      name: c.name,
      category: c.category,
      city: c.city,
      latitude: c.latitude,
      longitude: c.longitude,
      bedrooms: c.bedrooms,
      capacity: c.capacity,
      nightly_price: c.nightlyPrice,
      total_price: c.totalPrice,
      currency: c.currency,
      rating: c.rating,
      reviews_count: c.reviewsCount,
      is_superhost: c.isSuperhost,
      guest_favorite: c.guestFavorite,
      thumbnail: c.thumbnail,
      check_in: params.checkIn,
      check_out: params.checkOut,
      nights,
      raw: c.raw,
    }));
    const { error: compErr } = await (supabase.from("market_comps") as any) // eslint-disable-line @typescript-eslint/no-explicit-any
      .insert(rows);
    if (compErr) throw compErr;
  }

  return {
    snapshotId,
    source,
    sampleSize: stats.sampleSize,
    totalResults,
    radiusKm,
    suggestedNightly: stats.suggestedNightly,
    yourNightly,
    priceMedian: stats.priceMedian,
    priceP25: stats.priceP25,
    priceP75: stats.priceP75,
    creditsUsed,
    comps: allComps.length,
  };
}
