import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Global search (#21). Looks across the three high-traffic entities a user
 * jumps to from the topbar: reservations, guests and properties. Each group is
 * capped so the dropdown stays light; the company scope is always enforced.
 */

export interface SearchResultItem {
  id: string;
  title: string;
  subtitle?: string | null;
  href: string;
}

export interface GlobalSearchResults {
  reservations: SearchResultItem[];
  guests: SearchResultItem[];
  properties: SearchResultItem[];
}

const EMPTY: GlobalSearchResults = { reservations: [], guests: [], properties: [] };

/** Strip PostgREST .or()/.ilike control chars to avoid filter-expression injection. */
function sanitize(term: string): string {
  return term.replace(/[%,()*_:]/g, "").trim().slice(0, 80);
}

export async function globalSearch(companyId: string, rawTerm: string): Promise<GlobalSearchResults> {
  const term = sanitize(rawTerm);
  if (term.length < 2) return EMPTY;

  const supabase = createAdminClient();
  const like = `%${term}%`;

  const [guestsRes, propsRes, resvRes] = await Promise.all([
    supabase
      .from("guests")
      .select("id, full_name, email, phone, city")
      .eq("company_id", companyId)
      .or(`full_name.ilike.${like},email.ilike.${like},phone.ilike.${like}`)
      .order("full_name")
      .limit(5),
    supabase
      .from("properties")
      .select("id, name, code, city, neighborhood")
      .eq("company_id", companyId)
      .or(`name.ilike.${like},code.ilike.${like},city.ilike.${like}`)
      .order("name")
      .limit(5),
    supabase
      .from("reservations")
      .select("id, booking_code, check_in_date, check_out_date, guest:guests(full_name), property:properties(name)")
      .eq("company_id", companyId)
      .is("deleted_at", null)
      .ilike("booking_code", like)
      .order("check_in_date", { ascending: false })
      .limit(5),
  ]);

  type GuestRow = { id: string; full_name: string; email: string | null; phone: string | null; city: string | null };
  type PropRow = { id: string; name: string; code: string; city: string | null; neighborhood: string | null };
  type ResvRow = {
    id: string;
    booking_code: string;
    check_in_date: string;
    guest: { full_name: string } | { full_name: string }[] | null;
    property: { name: string } | { name: string }[] | null;
  };

  const one = <T,>(rel: T | T[] | null): T | null => (Array.isArray(rel) ? rel[0] ?? null : rel);

  const guests = ((guestsRes.data as GuestRow[] | null) ?? []).map((g) => ({
    id: g.id,
    title: g.full_name,
    subtitle: g.email || g.phone || g.city || null,
    href: `/guests/${g.id}`,
  }));

  const properties = ((propsRes.data as PropRow[] | null) ?? []).map((p) => ({
    id: p.id,
    title: p.name,
    subtitle: [p.code, p.neighborhood || p.city].filter(Boolean).join(" · ") || null,
    href: `/properties/${p.id}`,
  }));

  const reservations = ((resvRes.data as ResvRow[] | null) ?? []).map((r) => {
    const guestName = one(r.guest)?.full_name;
    const propName = one(r.property)?.name;
    return {
      id: r.id,
      title: r.booking_code,
      subtitle: [guestName, propName].filter(Boolean).join(" · ") || null,
      href: `/reservations/${r.id}`,
    };
  });

  return { reservations, guests, properties };
}
