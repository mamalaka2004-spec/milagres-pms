import { createAdminClient } from "@/lib/supabase/admin";
import { canonicalBR, last8 as last8Of, samePhone } from "@/lib/whatsapp/phone";
import type { Database } from "@/types/database";

export type GuideRow = Database["public"]["Tables"]["property_guides"]["Row"];
export type KbRow = Database["public"]["Tables"]["kb_articles"]["Row"];

const PRIVATE_BUCKET = "property-guides";

/** Public-safe subset of a guide (no wifi/lock/exact address). Safe for leads. */
export function publicGuide(g: GuideRow) {
  return {
    unit_code: g.unit_code,
    name: g.name,
    type: g.property_type,
    condo: g.condo,
    region: g.region,
    max_guests: g.max_guests,
    suites: g.suites,
    beds: g.beds,
    bathrooms: g.bathrooms,
    description: g.short_description || g.description,
    amenities: g.amenities || [],
    house_rules: g.house_rules || [],
    check_in_time: g.check_in_time,
    check_out_time: g.check_out_time,
    cancellation_policy: g.cancellation_policy,
    video_urls: g.video_urls || [],
    image_urls: g.image_urls || [],
  };
}

/** Private fields — only ever returned after a confirmed-reservation check. */
export function privateGuide(g: GuideRow) {
  return {
    wifi_ssid: g.wifi_ssid,
    wifi_password: g.wifi_password,
    access_method: g.access_method,
    door_code: g.door_code,
    access_instructions: g.access_instructions,
    exact_address: g.exact_address,
    maps_url: g.maps_url,
  };
}

export async function listGuides(companyId: string): Promise<GuideRow[]> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("property_guides")
    .select("*")
    .eq("company_id", companyId)
    .eq("active", true)
    .order("name");
  return (data as GuideRow[]) || [];
}

export async function getGuide(
  companyId: string,
  by: { unit_code?: string; name?: string; property_id?: string }
): Promise<GuideRow | null> {
  const supabase = createAdminClient();
  let q = supabase
    .from("property_guides")
    .select("*")
    .eq("company_id", companyId)
    .eq("active", true)
    .limit(1);
  if (by.unit_code) q = q.eq("unit_code", by.unit_code);
  else if (by.property_id) q = q.eq("property_id", by.property_id);
  else if (by.name) q = q.ilike("name", `%${by.name}%`);
  else return null;
  const { data } = await q.maybeSingle();
  return (data as GuideRow | null) ?? null;
}

/**
 * Search the shared knowledge base / FAQ. Leads get only `public` rows;
 * confirmed guests also get `confirmed_guest` rows.
 */
export async function searchKb(
  companyId: string,
  opts: { query?: string; category?: string; includeConfirmed?: boolean; limit?: number }
): Promise<KbRow[]> {
  const supabase = createAdminClient();
  let q = supabase
    .from("kb_articles")
    .select("*")
    .eq("company_id", companyId)
    .eq("active", true);

  if (!opts.includeConfirmed) q = q.eq("visibility", "public");
  if (opts.category) q = q.eq("category", opts.category);
  if (opts.query && opts.query.trim()) {
    // Sanitize: this string is interpolated into a PostgREST .or() filter, so strip the
    // characters that have meaning there (commas, parens, %, *, _, :, braces) to avoid
    // breaking the filter or injecting extra conditions.
    const clean = opts.query.replace(/[%,()*_:{}]/g, " ").trim().slice(0, 80);
    if (clean) {
      const term = `%${clean}%`;
      q = q.or(`title.ilike.${term},content.ilike.${term},tags.cs.{${clean}}`);
    }
  }
  const limit = Math.min(Math.max(Math.trunc(Number(opts.limit)) || 12, 1), 50);
  q = q.order("sort_order").limit(limit);
  const { data } = await q;
  return (data as KbRow[]) || [];
}

export interface ConfirmedReservation {
  id: string;
  booking_code: string;
  property_id: string;
  check_in_date: string;
  check_out_date: string;
  status: string;
  guest_id: string;
  guest_name: string | null;
  property_name: string | null;
}

/**
 * Resolve a caller's phone to a SINGLE guest, failing closed.
 *
 * Identity is security-critical here (it gates Wi-Fi / lock codes), so we do NOT match
 * on a loose "last 8 digits" substring. We use last-8 only as a broad SQL candidate net,
 * then require a strict canonical match (DDD + last 8, country-code/9th-digit agnostic).
 * If more than one DISTINCT guest matches the same number, we refuse (return "ambiguous")
 * rather than risk leaking another person's data.
 */
export async function resolveGuestByPhone(
  companyId: string,
  rawPhone: string | null | undefined
): Promise<{ id: string; full_name: string | null } | null | "ambiguous"> {
  const key = canonicalBR(rawPhone);
  if (!key) return null; // too short to identify safely
  const supabase = createAdminClient();

  const { data: guests } = await supabase
    .from("guests")
    .select("id, full_name, phone")
    .eq("company_id", companyId)
    .ilike("phone", `%${last8Of(rawPhone)}%`)
    .limit(25);
  const candidates =
    (guests as Array<{ id: string; full_name: string | null; phone: string | null }>) || [];

  const strict = candidates.filter((g) => samePhone(g.phone, rawPhone));
  const distinctIds = Array.from(new Set(strict.map((g) => g.id)));
  if (distinctIds.length === 0) return null;
  if (distinctIds.length > 1) return "ambiguous"; // different people share this number → fail closed
  const g = strict.find((x) => x.id === distinctIds[0])!;
  return { id: g.id, full_name: g.full_name };
}

/**
 * Resolve the caller (by phone) to their CONFIRMED / CHECKED_IN reservations that
 * are current or upcoming. Returns [] for leads / unknown / ambiguous numbers.
 * Uses the admin client (the WhatsApp AI path has no auth session → RLS would hide rows).
 */
export async function confirmedReservationsForPhone(
  companyId: string,
  rawPhone: string | null | undefined
): Promise<ConfirmedReservation[]> {
  const guest = await resolveGuestByPhone(companyId, rawPhone);
  if (!guest || guest === "ambiguous") return [];
  const supabase = createAdminClient();

  const today = new Date().toISOString().slice(0, 10);
  const { data: resv } = await supabase
    .from("reservations")
    .select(
      "id, booking_code, property_id, check_in_date, check_out_date, status, guest_id, property:properties(name)"
    )
    .eq("company_id", companyId)
    .eq("guest_id", guest.id)
    .in("status", ["confirmed", "checked_in"])
    .is("deleted_at", null)
    .gte("check_out_date", today)
    .order("check_in_date", { ascending: true });

  type R = {
    id: string;
    booking_code: string;
    property_id: string;
    check_in_date: string;
    check_out_date: string;
    status: string;
    guest_id: string;
    property: { name: string } | null;
  };
  const rows = (resv as unknown as R[]) || [];
  return rows.map((r) => ({
    id: r.id,
    booking_code: r.booking_code,
    property_id: r.property_id,
    check_in_date: r.check_in_date,
    check_out_date: r.check_out_date,
    status: r.status,
    guest_id: r.guest_id,
    guest_name: guest.full_name,
    property_name: r.property?.name ?? null,
  }));
}

/**
 * Map a reservation to its property guide — DETERMINISTICALLY.
 *
 * Private credentials (Wi-Fi, lock code, exact address) are released based on this, so
 * we ONLY trust the explicit reservation.property_id → property_guides.property_id link.
 * Fuzzy name matching is intentionally NOT used: with repeated condos (Kanui/Tamoná) and
 * listing names that differ from unit names, a single substring hit could be the WRONG
 * unit and leak its door code. When there's no explicit link we return matched=false and
 * the caller falls back to "the team will send your access details".
 */
export async function resolveGuideForReservation(
  companyId: string,
  reservation: { property_id: string; property_name: string | null }
): Promise<{ guide: GuideRow | null; matched: boolean }> {
  if (!reservation.property_id) return { guide: null, matched: false };
  const linked = await getGuide(companyId, { property_id: reservation.property_id });
  return { guide: linked, matched: !!linked };
}

/** Generate a time-limited signed URL for a guide PDF in the private bucket. */
export async function signGuidePdf(
  path: string | null,
  expiresInSeconds = 60 * 60 * 24
): Promise<string | null> {
  if (!path) return null;
  const supabase = createAdminClient();
  const { data } = await supabase.storage
    .from(PRIVATE_BUCKET)
    .createSignedUrl(path, expiresInSeconds);
  return data?.signedUrl ?? null;
}
