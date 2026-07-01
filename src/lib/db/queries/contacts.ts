/* eslint-disable @typescript-eslint/no-explicit-any */
// ===========================================================================
// Fonebook (whatsapp_contacts) — busca para seletores cross-base (Fase 2/B)
// ===========================================================================
import { createAdminClient } from "@/lib/supabase/admin";
import type { ContactLite } from "@/types/campaign";

const COLS = "id, display_name, phone_e164, phone_canonical, category, unit_hint, line_id";

export async function searchContacts(
  companyId: string,
  opts: { q?: string; category?: string; lineId?: string; limit?: number } = {}
): Promise<ContactLite[]> {
  let query = (createAdminClient().from("whatsapp_contacts") as any)
    .select(COLS)
    .eq("company_id", companyId);
  if (opts.category) query = query.eq("category", opts.category);
  if (opts.lineId) query = query.eq("line_id", opts.lineId);
  if (opts.q && opts.q.trim()) {
    const q = opts.q.trim().replace(/[%,]/g, "");
    query = query.or(`display_name.ilike.%${q}%,phone_e164.ilike.%${q}%,phone_canonical.ilike.%${q}%`);
  }
  const { data, error } = await query
    .order("display_name", { ascending: true, nullsFirst: false })
    .limit(opts.limit ?? 50);
  if (error) throw error;
  return (data as ContactLite[]) || [];
}

export async function getContactsByIds(companyId: string, ids: string[]): Promise<ContactLite[]> {
  if (!ids.length) return [];
  const { data, error } = await (createAdminClient().from("whatsapp_contacts") as any)
    .select(COLS)
    .eq("company_id", companyId)
    .in("id", ids);
  if (error) throw error;
  return (data as ContactLite[]) || [];
}
