import { createAdminClient } from "@/lib/supabase/admin";
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
    const term = `%${opts.query.trim()}%`;
    // match title OR content OR any tag
    q = q.or(`title.ilike.${term},content.ilike.${term},tags.cs.{${opts.query.trim()}}`);
  }
  q = q.order("sort_order").limit(opts.limit ?? 12);
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
 * Resolve the caller (by phone) to their CONFIRMED / CHECKED_IN reservations that
 * are current or upcoming. Returns [] for leads / unknown numbers.
 * Uses the admin client (the WhatsApp AI path has no auth session → RLS would hide rows).
 */
export async function confirmedReservationsForPhone(
  companyId: string,
  rawPhone: string | null | undefined
): Promise<ConfirmedReservation[]> {
  const phone = (rawPhone || "").replace(/\D/g, "");
  if (phone.length < 8) return [];
  const last8 = phone.slice(-8);
  const supabase = createAdminClient();

  const { data: guests } = await supabase
    .from("guests")
    .select("id, full_name")
    .eq("company_id", companyId)
    .ilike("phone", `%${last8}%`)
    .limit(5);
  const guestRows = (guests as Array<{ id: string; full_name: string | null }>) || [];
  if (guestRows.length === 0) return [];

  const today = new Date().toISOString().slice(0, 10);
  const { data: resv } = await supabase
    .from("reservations")
    .select(
      "id, booking_code, property_id, check_in_date, check_out_date, status, guest_id, property:properties(name)"
    )
    .eq("company_id", companyId)
    .in("guest_id", guestRows.map((g) => g.id))
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
  const nameById = new Map(guestRows.map((g) => [g.id, g.full_name] as const));
  return rows.map((r) => ({
    id: r.id,
    booking_code: r.booking_code,
    property_id: r.property_id,
    check_in_date: r.check_in_date,
    check_out_date: r.check_out_date,
    status: r.status,
    guest_id: r.guest_id,
    guest_name: nameById.get(r.guest_id) ?? null,
    property_name: r.property?.name ?? null,
  }));
}

/**
 * Map a reservation to its property guide. Prefers the explicit property_id link;
 * falls back to a best-effort name match (until guides are linked in the PMS).
 * Returns { guide, matched }. `matched=false` means we could not safely identify
 * the unit and must NOT leak any private credentials.
 */
export async function resolveGuideForReservation(
  companyId: string,
  reservation: { property_id: string; property_name: string | null }
): Promise<{ guide: GuideRow | null; matched: boolean }> {
  // 1. explicit link
  const linked = await getGuide(companyId, { property_id: reservation.property_id });
  if (linked) return { guide: linked, matched: true };

  // 2. best-effort name token match (single unambiguous hit only)
  const all = await listGuides(companyId);
  const pname = (reservation.property_name || "").toLowerCase();
  if (pname) {
    const hits = all.filter((g) => {
      const tokens = [g.name, g.condo, g.unit_code]
        .filter(Boolean)
        .map((t) => String(t).toLowerCase());
      return tokens.some((t) => t && (pname.includes(t) || t.includes(pname)));
    });
    if (hits.length === 1) return { guide: hits[0], matched: true };
  }
  return { guide: null, matched: false };
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
