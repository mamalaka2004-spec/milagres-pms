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
  first_name?: string | null;
  last_name?: string | null;
  social_name?: string | null;
  instagram_handle?: string | null;
  category?: string | null;
  tags?: string[];
  rating?: number | null;
  notes?: string | null;
  do_not_contact?: boolean;
}

/** Normaliza um @handle digitado (remove @, espaços, url). */
function cleanHandle(raw: string | null | undefined): string | null {
  const s = (raw ?? "").trim().replace(/^https?:\/\/(www\.)?instagram\.com\//i, "").replace(/^@/, "").replace(/\/.*$/, "");
  return s ? s.toLowerCase() : null;
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
      first_name: input.first_name?.trim() || null,
      last_name: input.last_name?.trim() || null,
      social_name: input.social_name?.trim() || null,
      instagram_handle: cleanHandle(input.instagram_handle),
      name_reviewed_at: new Date().toISOString(),
      name_source: "manual",
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
  if (input.first_name !== undefined) patch.first_name = input.first_name?.trim() || null;
  if (input.last_name !== undefined) patch.last_name = input.last_name?.trim() || null;
  if (input.social_name !== undefined) patch.social_name = input.social_name?.trim() || null;
  if (input.instagram_handle !== undefined) patch.instagram_handle = cleanHandle(input.instagram_handle);
  // Edição manual dos nomes = revisado por uma pessoa.
  if (
    input.first_name !== undefined ||
    input.last_name !== undefined ||
    input.social_name !== undefined ||
    input.display_name !== undefined
  ) {
    patch.name_source = "manual";
    patch.name_reviewed_at = new Date().toISOString();
  }
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
    .limit(5000);
  if (error) throw error;
  const set = new Set<string>();
  for (const row of (data as { tags: string[] }[]) || []) {
    for (const t of row.tags || []) if (t?.trim()) set.add(t.trim());
  }
  return [...set].sort((a, b) => a.localeCompare(b, "pt-BR"));
}

/** Todas as etiquetas com a contagem de contatos que as usam. */
export async function listContactTagsWithCount(companyId: string): Promise<{ tag: string; count: number }[]> {
  const { data, error } = await (createAdminClient().from("whatsapp_contacts") as any)
    .select("tags")
    .eq("company_id", companyId)
    .not("tags", "eq", "{}")
    .limit(5000);
  if (error) throw error;
  const counts = new Map<string, number>();
  for (const row of (data as { tags: string[] }[]) || []) {
    for (const t of row.tags || []) {
      const key = t?.trim();
      if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag, "pt-BR"));
}

/** Renomeia uma etiqueta em toda a base (mescla se o destino já existir). */
export async function renameContactTag(companyId: string, from: string, to: string): Promise<number> {
  const src = from.trim();
  const dst = to.trim().toLowerCase();
  if (!src || !dst) return 0;
  const db = createAdminClient();
  const { data } = await (db.from("whatsapp_contacts") as any)
    .select("id, tags")
    .eq("company_id", companyId)
    .contains("tags", [src])
    .limit(5000);
  const rows = (data as { id: string; tags: string[] }[]) || [];
  const updates = rows.map((r) => {
    const set = new Set((r.tags || []).map((t) => (t === src ? dst : t)));
    return (db.from("whatsapp_contacts") as any)
      .update({ tags: [...set] })
      .eq("id", r.id)
      .eq("company_id", companyId);
  });
  for (let i = 0; i < updates.length; i += 25) await Promise.all(updates.slice(i, i + 25));
  return rows.length;
}

/** Remove uma etiqueta de toda a base. */
export async function deleteContactTag(companyId: string, tag: string): Promise<number> {
  const t = tag.trim();
  if (!t) return 0;
  const db = createAdminClient();
  const { data } = await (db.from("whatsapp_contacts") as any)
    .select("id, tags")
    .eq("company_id", companyId)
    .contains("tags", [t])
    .limit(5000);
  const rows = (data as { id: string; tags: string[] }[]) || [];
  const updates = rows.map((r) =>
    (db.from("whatsapp_contacts") as any)
      .update({ tags: (r.tags || []).filter((x) => x !== t) })
      .eq("id", r.id)
      .eq("company_id", companyId)
  );
  for (let i = 0; i < updates.length; i += 25) await Promise.all(updates.slice(i, i + 25));
  return rows.length;
}
