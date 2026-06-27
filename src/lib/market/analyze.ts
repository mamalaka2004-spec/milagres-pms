import type { GeckoPlpItem, MarketSource } from "@/lib/gecko/types";

/** Normalized competitor comp ready to persist. */
export interface NormalizedComp {
  source: MarketSource;
  listingId: string | null;
  url: string | null;
  title: string | null;
  name: string | null;
  category: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  bedrooms: number | null;
  capacity: number | null;
  nightlyPrice: number | null;
  totalPrice: number | null;
  currency: string;
  rating: number | null;
  reviewsCount: number | null;
  isSuperhost: boolean;
  guestFavorite: boolean;
  thumbnail: string | null;
  raw: GeckoPlpItem;
}

/**
 * Parse bedroom count from Airbnb's highlights array, e.g.
 * ["1 quarto", "2 camas", "1 banheiro"] → 1. "Studio"/"Estúdio" → 0.
 * Returns null when it can't be determined.
 */
export function parseBedrooms(highlights?: string[]): number | null {
  if (!highlights || highlights.length === 0) return null;
  for (const h of highlights) {
    const low = h.toLowerCase();
    if (low.includes("studio") || low.includes("estúdio") || low.includes("estudio")) return 0;
    const m = low.match(/(\d+)\s*quarto/);
    if (m) return parseInt(m[1], 10);
  }
  return null;
}

/**
 * Parse a BRL total from Gecko's `totalPriceLabel`, e.g. "Total: R$ 2.990" → 2990, or
 * "O preço original era R$ 2.217 e o novo preço total é R$ 1.948" → 1948 (last R$ token).
 *
 * IMPORTANT: the numeric `price` field from Gecko mis-handles the pt-BR thousands
 * separator (it returns 2.99 for "R$ 2.990"), so the label is the source of truth.
 * pt-BR format: "." = thousands, "," = decimals.
 */
export function parsePriceLabel(label: string | null | undefined, fallback: number | null): number | null {
  if (label) {
    const matches = [...label.matchAll(/R\$[\s ]*([\d.,]+)/g)];
    if (matches.length > 0) {
      const tok = matches[matches.length - 1][1];
      const n = parseFloat(tok.replace(/\./g, "").replace(",", "."));
      if (!Number.isNaN(n) && n > 0) return n;
    }
  }
  return fallback;
}

/** Whole nights between two YYYY-MM-DD dates (min 1). */
export function nightsBetween(checkIn: string, checkOut: string): number {
  const a = new Date(`${checkIn}T00:00:00Z`).getTime();
  const b = new Date(`${checkOut}T00:00:00Z`).getTime();
  const n = Math.round((b - a) / 86_400_000);
  return n > 0 ? n : 1;
}

/** Normalize one PLP item into a comp; price is the window total → divide by nights. */
export function normalizeComp(item: GeckoPlpItem, source: MarketSource, nights: number): NormalizedComp {
  // Prefer the label (reliable); the numeric `price` field corrupts pt-BR thousands.
  const total = parsePriceLabel(item.totalPriceLabel, typeof item.price === "number" ? item.price : null);
  const nightly = total != null ? Math.round((total / nights) * 100) / 100 : null;
  return {
    source,
    listingId: item.listingId ?? null,
    url: item.url ?? null,
    title: item.title ?? null,
    name: item.name ?? null,
    category: item.category ?? null,
    city: item.city ?? null,
    latitude: item.latitude ?? null,
    longitude: item.longitude ?? null,
    bedrooms: parseBedrooms(item.highlights),
    capacity: null,
    nightlyPrice: nightly,
    totalPrice: total,
    currency: item.currency || "BRL",
    rating: item.aggregateRating?.rating ?? null,
    reviewsCount: item.aggregateRating?.reviewCount ?? null,
    isSuperhost: item.superhost === true || (item.badges?.includes("Superhost") ?? false),
    guestFavorite: item.guestFavorite === true,
    thumbnail: item.thumbnail ?? null,
    raw: item,
  };
}

function percentile(sortedAsc: number[], p: number): number | null {
  if (sortedAsc.length === 0) return null;
  if (sortedAsc.length === 1) return sortedAsc[0];
  const idx = (sortedAsc.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sortedAsc[lo];
  return Math.round((sortedAsc[lo] + (sortedAsc[hi] - sortedAsc[lo]) * (idx - lo)) * 100) / 100;
}

export interface MarketStats {
  sampleSize: number;
  priceMin: number | null;
  priceP25: number | null;
  priceMedian: number | null;
  priceP75: number | null;
  priceMax: number | null;
  suggestedNightly: number | null;
}

/**
 * Compute market statistics from comps, restricting to listings comparable to ours
 * (bedrooms within ±1 when we know our bedroom count and the comp's). Falls back to the
 * full priced set if the comparable subset is too small (< 4). Suggested nightly = median
 * of the comparable set, nudged toward p75 for Superhost/Guest-favorite density.
 */
export function computeStats(comps: NormalizedComp[], ourBedrooms: number | null): MarketStats {
  const priced = comps.filter((c) => typeof c.nightlyPrice === "number" && c.nightlyPrice! > 0);

  let comparable = priced;
  if (ourBedrooms != null) {
    const near = priced.filter((c) => c.bedrooms != null && Math.abs(c.bedrooms - ourBedrooms) <= 1);
    if (near.length >= 4) comparable = near;
  }

  const prices = comparable.map((c) => c.nightlyPrice as number).sort((a, b) => a - b);
  const median = percentile(prices, 0.5);
  const p75 = percentile(prices, 0.75);

  // Quality nudge: if most comparable listings are Superhost / guest favorites, the
  // market skews premium — lean the suggestion ~25% of the way from median to p75.
  let suggested = median;
  if (median != null && p75 != null && comparable.length > 0) {
    const premiumShare =
      comparable.filter((c) => c.isSuperhost || c.guestFavorite).length / comparable.length;
    if (premiumShare >= 0.5) {
      suggested = Math.round((median + (p75 - median) * 0.25) * 100) / 100;
    }
  }

  return {
    sampleSize: comparable.length,
    priceMin: percentile(prices, 0),
    priceP25: percentile(prices, 0.25),
    priceMedian: median,
    priceP75: p75,
    priceMax: percentile(prices, 1),
    suggestedNightly: suggested,
  };
}

/** Build the provider search URL for a place. */
export function buildSearchUrl(source: MarketSource, place: string): string {
  if (source === "booking") return "https://www.booking.com/searchresults.pt-br.html";
  const slug = encodeURIComponent(place.trim().replace(/\s+/g, "-"));
  return `https://www.airbnb.com.br/s/${slug}/homes`;
}
