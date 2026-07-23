/* eslint-disable @typescript-eslint/no-explicit-any */
// ===========================================================================
// Fonebook (whatsapp_contacts) — busca, CRUD e filtros (página Contatos +
// seletores cross-base de campanhas/listas/prospecção).
// ===========================================================================
import { createAdminClient } from "@/lib/supabase/admin";
import { canonicalBR } from "@/lib/whatsapp/phone";
import type { ContactLite } from "@/types/campaign";

const COLS =
  "id, display_name, phone_e164, phone_canonical, category, unit_hint, line_id, tags, rating, notes, do_not_contact, source, created_at, first_name, last_name, social_name, name_reviewed_at, instagram_handle, name_confidence, name_source, raw_label";

export interface ContactFilters {
  q?: string;
  category?: string;
  lineId?: string;
  tag?: string;
  minRating?: number;
  doNotContact?: boolean; // true = só opt-out; false = só contatáveis
  /** Qualidade do nome: 'pendente' = ainda não revisado; 'sem_nome' = sem
   *  first_name (campanha sai sem saudação); 'ok' = já tem nome tratado. */
  nameStatus?: "pendente" | "sem_nome" | "ok";
  limit?: number;
  offset?: number;
}

function buildQuery(companyId: string, opts: ContactFilters, head = false) {
  let query = (createAdminClient().from("whatsapp_contacts") as any)
    .select(head ? "id" : COLS, head ? { count: "exact", head: true } : { count: "exact" })
    .eq("company_id", companyId);
  if (opts.category) query = query.eq("category", opts.category);
  if (opts.lineId) query = query.eq("line_id", opts.lineId);
  if (opts.tag) query = query.contains("tags", [opts.tag]);
  if (opts.minRating) query = query.gte("rating", opts.minRating);
  if (opts.doNotContact !== undefined) query = query.eq("do_not_contact", opts.doNotContact);
  if (opts.nameStatus === "pendente") query = query.is("name_reviewed_at", null);
  if (opts.nameStatus === "sem_nome") query = query.is("first_name", null);
  if (opts.nameStatus === "ok") query = query.not("first_name", "is", null);
  if (opts.q && opts.q.trim()) {
    const q = opts.q.trim().replace(/[%,]/g, "");
    query = query.or(`display_name.ilike.%${q}%,phone_e164.ilike.%${q}%,phone_canonical.ilike.%${q}%`);
  }
  return query;
}

export async function searchContacts(
  companyId: string,
  opts: ContactFilters = {}
): Promise<ContactLite[]> {
  const { data, error } = await buildQuery(companyId, opts)
    .order("display_name", { ascending: true, nullsFirst: false })
    .limit(opts.limit ?? 50);
  if (error) throw error;
  return (data as ContactLite[]) || [];
}

/** Lista paginada (página Contatos): rows + total dos filtros. */
export async function listContactsPaged(
  companyId: string,
  opts: ContactFilters = {}
): Promise<{ contacts: ContactLite[]; total: number }> {
  const limit = Math.min(opts.limit ?? 50, 200);
  const offset = Math.max(opts.offset ?? 0, 0);
  const { data, count, error } = await buildQuery(companyId, opts)
    .order("display_name", { ascending: true, nullsFirst: false })
    .range(offset, offset + limit - 1);
  if (error) throw error;
  return { contacts: (data as ContactLite[]) || [], total: count ?? 0 };
}

/** Só os IDs que batem no filtro — para "selecionar todos" além da página atual. */
export async function listContactIds(companyId: string, opts: ContactFilters = {}): Promise<string[]> {
  const { data, error } = await buildQuery(companyId, opts).limit(5000);
  if (error) throw error;
  return ((data as { id: string }[]) || []).map((r) => r.id);
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

// ─── CRUD ──────────────────────────────────────────────────────────────────
export interface ContactInput {
  display_name?: string | null;
  phone?: string;
  category?: string | null;
  tags?: string[];
  rating?: number | null;
  notes?: string | null;
  do_not_contact?: boolean;
}

export async function createContact(
  companyId: string,
  input: ContactInput
): Promise<ContactLite> {
  const canonical = canonicalBR(input.phone ?? "");
  if (!canonical) throw new Error("Telefone inválido — informe DDD + número");
  const phoneE164 = (input.phone ?? "").startsWith("+")
    ? input.phone!
    : `+55${(input.phone ?? "").replace(/\D/g, "").replace(/^55/, "")}`;

  const db = createAdminClient();
  const { data: dup } = await (db.from("whatsapp_contacts") as any)
    .select("id, display_name")
    .eq("company_id", companyId)
    .eq("phone_canonical", canonical)
    .maybeSingle();
  if (dup) throw new Error(`Já existe um contato com este telefone (${dup.display_name || "sem nome"})`);

  const { data, error } = await (db.from("whatsapp_contacts") as any)
    .insert({
      company_id: companyId,
      phone_e164: phoneE164,
      phone_canonical: canonical,
      display_name: input.display_name?.trim() || null,
      category: input.category ?? "lead",
      tags: input.tags ?? [],
      rating: input.rating ?? null,
      notes: input.notes ?? null,
      do_not_contact: input.do_not_contact ?? false,
      source: "manual",
    })
    .select(COLS)
    .single();
  if (error) throw error;
  return data as ContactLite;
}

export async function updateContact(
  contactId: string,
  companyId: string,
  input: ContactInput
): Promise<ContactLite> {
  const patch: Record<string, unknown> = {};
  if (input.display_name !== undefined) patch.display_name = input.display_name?.trim() || null;
  if (input.category !== undefined) patch.category = input.category;
  if (input.tags !== undefined) patch.tags = input.tags;
  if (input.rating !== undefined) patch.rating = input.rating;
  if (input.notes !== undefined) patch.notes = input.notes;
  if (input.do_not_contact !== undefined) {
    patch.do_not_contact = input.do_not_contact;
    patch.opted_out_at = input.do_not_contact ? new Date().toISOString() : null;
    patch.opt_out_source = input.do_not_contact ? "manual" : null;
  }
  if (input.phone !== undefined) {
    const canonical = canonicalBR(input.phone);
    if (!canonical) throw new Error("Telefone inválido — informe DDD + número");
    patch.phone_canonical = canonical;
    patch.phone_e164 = input.phone.startsWith("+")
      ? input.phone
      : `+55${input.phone.replace(/\D/g, "").replace(/^55/, "")}`;
  }
  const { data, error } = await (createAdminClient().from("whatsapp_contacts") as any)
    .update(patch)
    .eq("id", contactId)
    .eq("company_id", companyId)
    .select(COLS)
    .single();
  if (error) throw error;
  return data as ContactLite;
}

export async function deleteContact(contactId: string, companyId: string): Promise<void> {
  const { error } = await (createAdminClient().from("whatsapp_contacts") as any)
    .delete()
    .eq("id", contactId)
    .eq("company_id", companyId);
  if (error) throw error;
}

/** Tags distintas em uso (para sugestões/filtros). */
export async function listContactTags(companyId: string): Promise<string[]> {
  const { data, error } = await (createAdminClient().from("whatsapp_contacts") as any)
    .select("tags")
    .eq("company_id", companyId)
    .not("tags", "eq", "{}")
    .limit(2000);
  if (error) throw error;
  const set = new Set<string>();
  for (const row of (data as { tags: string[] }[]) || []) {
    for (const t of row.tags || []) if (t?.trim()) set.add(t.trim());
  }
  return [...set].sort((a, b) => a.localeCompare(b, "pt-BR"));
}
