/* eslint-disable @typescript-eslint/no-explicit-any */
// ===========================================================================
// Listas de contatos (contact_lists / contact_list_members) — migration 036
// Listas salvas do fonebook, usadas como audiência de campanhas.
// ===========================================================================
import { createAdminClient } from "@/lib/supabase/admin";
import type { ContactList, ContactLite } from "@/types/campaign";

const CONTACT_COLS =
  "id, display_name, phone_e164, phone_canonical, category, unit_hint, line_id, do_not_contact";

function db() {
  return createAdminClient();
}

export async function listContactLists(companyId: string): Promise<ContactList[]> {
  const { data, error } = await (db().from("contact_lists") as any)
    .select("*, contact_list_members(count)")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return ((data as any[]) || []).map((row) => {
    const { contact_list_members, ...list } = row;
    return { ...list, member_count: contact_list_members?.[0]?.count ?? 0 } as ContactList;
  });
}

export async function getContactList(id: string, companyId: string): Promise<ContactList | null> {
  const { data } = await (db().from("contact_lists") as any)
    .select("*")
    .eq("id", id)
    .eq("company_id", companyId)
    .maybeSingle();
  return (data as ContactList | null) ?? null;
}

export async function createContactList(
  companyId: string,
  createdBy: string | null,
  input: { name: string; description?: string | null }
): Promise<ContactList> {
  const { data, error } = await (db().from("contact_lists") as any)
    .insert({
      company_id: companyId,
      name: input.name,
      description: input.description ?? null,
      created_by: createdBy,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as ContactList;
}

export async function updateContactList(
  id: string,
  companyId: string,
  patch: Record<string, unknown>
): Promise<ContactList> {
  const { data, error } = await (db().from("contact_lists") as any)
    .update(patch)
    .eq("id", id)
    .eq("company_id", companyId)
    .select("*")
    .single();
  if (error) throw error;
  return data as ContactList;
}

export async function deleteContactList(id: string, companyId: string): Promise<void> {
  const { error } = await (db().from("contact_lists") as any)
    .delete()
    .eq("id", id)
    .eq("company_id", companyId);
  if (error) throw error;
}

// ─── Membros ───────────────────────────────────────────────────────────────
export async function listMembers(listId: string): Promise<ContactLite[]> {
  const { data, error } = await (db().from("contact_list_members") as any)
    .select(`contact:whatsapp_contacts(${CONTACT_COLS})`)
    .eq("list_id", listId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return ((data as any[]) || []).map((row) => row.contact).filter(Boolean) as ContactLite[];
}

/** Adiciona contatos à lista (idempotente — ignora quem já está). */
export async function addMembers(listId: string, contactIds: string[]): Promise<number> {
  if (!contactIds.length) return 0;
  const rows = contactIds.map((contact_id) => ({ list_id: listId, contact_id }));
  const { error } = await (db().from("contact_list_members") as any).upsert(rows, {
    onConflict: "list_id,contact_id",
    ignoreDuplicates: true,
  });
  if (error) throw error;
  return countMembers(listId);
}

export async function removeMembers(listId: string, contactIds: string[]): Promise<number> {
  if (contactIds.length) {
    const { error } = await (db().from("contact_list_members") as any)
      .delete()
      .eq("list_id", listId)
      .in("contact_id", contactIds);
    if (error) throw error;
  }
  return countMembers(listId);
}

/** IDs de contato (dedup) de um conjunto de listas — audiência de campanha. */
export async function listMemberContactIds(listIds: string[]): Promise<string[]> {
  if (!listIds.length) return [];
  const { data, error } = await (db().from("contact_list_members") as any)
    .select("contact_id")
    .in("list_id", listIds);
  if (error) throw error;
  return [...new Set(((data as { contact_id: string }[]) || []).map((r) => r.contact_id))];
}

export async function countMembers(listId: string): Promise<number> {
  const { count } = await (db().from("contact_list_members") as any)
    .select("contact_id", { count: "exact", head: true })
    .eq("list_id", listId);
  return count ?? 0;
}

// ─── Opt-out manual (LGPD) ─────────────────────────────────────────────────
export async function setDoNotContact(
  contactId: string,
  companyId: string,
  doNotContact: boolean
): Promise<void> {
  const { error } = await (db().from("whatsapp_contacts") as any)
    .update({
      do_not_contact: doNotContact,
      opted_out_at: doNotContact ? new Date().toISOString() : null,
      opt_out_source: doNotContact ? "manual" : null,
    })
    .eq("id", contactId)
    .eq("company_id", companyId);
  if (error) throw error;
}
