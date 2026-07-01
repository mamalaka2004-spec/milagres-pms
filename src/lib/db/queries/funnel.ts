/* eslint-disable @typescript-eslint/no-explicit-any */
// ===========================================================================
// CRM Funil (deals) + Tags — query layer (Fase 2)
// Tabelas da migration 023. Acessadas via `(supabase.from(...) as any)` porque
// não estão nos tipos gerados (mesmo padrão de whatsapp_quick_replies).
// ===========================================================================
import { createAdminClient } from "@/lib/supabase/admin";
import {
  FunnelType,
  FunnelPipeline,
  FunnelStage,
  Tag,
  FunnelDeal,
  DealCardData,
  BoardData,
  linePurposeForType,
  VIRTUAL_DEAL_PREFIX,
} from "@/types/funnel";

function db() {
  return createAdminClient();
}

// ─── Line helpers (tipo → linhas WhatsApp) ─────────────────────────────────
export async function listLineIdsForType(companyId: string, type: FunnelType): Promise<string[]> {
  const { data } = await (db().from("whatsapp_lines") as any)
    .select("id")
    .eq("company_id", companyId)
    .eq("purpose", linePurposeForType(type));
  return ((data as { id: string }[]) || []).map((r) => r.id);
}

// ─── Pipelines ─────────────────────────────────────────────────────────────
export async function listPipelines(companyId: string, type?: FunnelType): Promise<FunnelPipeline[]> {
  let q = (db().from("funnel_pipelines") as any)
    .select("*")
    .eq("company_id", companyId)
    .eq("active", true)
    .order("type", { ascending: true })
    .order("sort_order", { ascending: true });
  if (type) q = q.eq("type", type);
  const { data, error } = await q;
  if (error) throw error;
  return (data as FunnelPipeline[]) || [];
}

export async function getPipeline(id: string): Promise<FunnelPipeline | null> {
  const { data } = await (db().from("funnel_pipelines") as any).select("*").eq("id", id).maybeSingle();
  return (data as FunnelPipeline | null) ?? null;
}

export async function getDefaultPipeline(companyId: string, type: FunnelType): Promise<FunnelPipeline | null> {
  const pipes = await listPipelines(companyId, type);
  return pipes.find((p) => p.is_default) ?? pipes[0] ?? null;
}

export async function createPipeline(
  companyId: string,
  input: { type: FunnelType; name: string; color?: string; is_default?: boolean }
): Promise<FunnelPipeline> {
  const client = db();
  const { data: maxRow } = await (client.from("funnel_pipelines") as any)
    .select("sort_order")
    .eq("company_id", companyId)
    .eq("type", input.type)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const sort_order = ((maxRow?.sort_order as number | undefined) ?? -1) + 1;
  // Se marcar como default, tira o default dos demais do mesmo tipo.
  if (input.is_default) {
    await (client.from("funnel_pipelines") as any)
      .update({ is_default: false })
      .eq("company_id", companyId)
      .eq("type", input.type);
  }
  const { data, error } = await (client.from("funnel_pipelines") as any)
    .insert({
      company_id: companyId,
      type: input.type,
      name: input.name,
      color: input.color ?? "#c9a84c",
      is_default: input.is_default ?? false,
      sort_order,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as FunnelPipeline;
}

export async function updatePipeline(
  id: string,
  companyId: string,
  patch: Partial<Pick<FunnelPipeline, "name" | "color" | "is_default" | "active" | "sort_order">>
): Promise<FunnelPipeline> {
  const client = db();
  if (patch.is_default) {
    const pipe = await getPipeline(id);
    if (pipe) {
      await (client.from("funnel_pipelines") as any)
        .update({ is_default: false })
        .eq("company_id", companyId)
        .eq("type", pipe.type);
    }
  }
  const { data, error } = await (client.from("funnel_pipelines") as any)
    .update(patch)
    .eq("id", id)
    .eq("company_id", companyId)
    .select("*")
    .single();
  if (error) throw error;
  return data as FunnelPipeline;
}

/** Arquiva o pipeline (soft delete). Não deixa remover o default. */
export async function archivePipeline(id: string, companyId: string): Promise<void> {
  const pipe = await getPipeline(id);
  if (pipe?.is_default) throw new Error("Não é possível remover o funil padrão. Defina outro como padrão primeiro.");
  const { error } = await (db().from("funnel_pipelines") as any)
    .update({ active: false, is_default: false })
    .eq("id", id)
    .eq("company_id", companyId);
  if (error) throw error;
}

// ─── Stages ────────────────────────────────────────────────────────────────
export async function listStages(pipelineId: string): Promise<FunnelStage[]> {
  const { data, error } = await (db().from("funnel_stages") as any)
    .select("*")
    .eq("pipeline_id", pipelineId)
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return (data as FunnelStage[]) || [];
}

export async function getStage(id: string): Promise<FunnelStage | null> {
  const { data } = await (db().from("funnel_stages") as any).select("*").eq("id", id).maybeSingle();
  return (data as FunnelStage | null) ?? null;
}

export async function createStage(input: {
  pipeline_id: string;
  name: string;
  color?: string;
  is_won?: boolean;
  is_lost?: boolean;
}): Promise<FunnelStage> {
  const client = db();
  const { data: maxRow } = await (client.from("funnel_stages") as any)
    .select("sort_order")
    .eq("pipeline_id", input.pipeline_id)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const sort_order = ((maxRow?.sort_order as number | undefined) ?? -1) + 1;
  const { data, error } = await (client.from("funnel_stages") as any)
    .insert({
      pipeline_id: input.pipeline_id,
      name: input.name,
      color: input.color ?? "#94a3b8",
      is_won: input.is_won ?? false,
      is_lost: input.is_lost ?? false,
      sort_order,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as FunnelStage;
}

export async function updateStage(
  id: string,
  patch: Partial<Pick<FunnelStage, "name" | "color" | "is_won" | "is_lost" | "sort_order">>
): Promise<FunnelStage> {
  const { data, error } = await (db().from("funnel_stages") as any)
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data as FunnelStage;
}

/** Remove uma etapa, movendo os negócios dela para a primeira etapa restante. */
export async function deleteStage(id: string): Promise<void> {
  const client = db();
  const { data: stage } = await (client.from("funnel_stages") as any)
    .select("id, pipeline_id")
    .eq("id", id)
    .maybeSingle();
  if (!stage) return;
  const { data: siblings } = await (client.from("funnel_stages") as any)
    .select("id")
    .eq("pipeline_id", stage.pipeline_id)
    .neq("id", id)
    .order("sort_order", { ascending: true })
    .limit(1);
  const target = (siblings as { id: string }[])?.[0]?.id;
  if (!target) throw new Error("Não é possível remover a única etapa do funil.");
  await (client.from("funnel_deals") as any).update({ stage_id: target }).eq("stage_id", id);
  const { error } = await (client.from("funnel_stages") as any).delete().eq("id", id);
  if (error) throw error;
}

export async function reorderStages(pipelineId: string, orderedIds: string[]): Promise<void> {
  const client = db();
  await Promise.all(
    orderedIds.map((id, idx) =>
      (client.from("funnel_stages") as any).update({ sort_order: idx }).eq("id", id).eq("pipeline_id", pipelineId)
    )
  );
}

// ─── Tags ──────────────────────────────────────────────────────────────────
export async function listTags(companyId: string, type?: FunnelType): Promise<Tag[]> {
  let q = (db().from("tags") as any)
    .select("*")
    .eq("company_id", companyId)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
  if (type) q = q.eq("type", type);
  const { data, error } = await q;
  if (error) throw error;
  return (data as Tag[]) || [];
}

export async function createTag(
  companyId: string,
  input: { type: FunnelType; name: string; color?: string }
): Promise<Tag> {
  const client = db();
  const { data: maxRow } = await (client.from("tags") as any)
    .select("sort_order")
    .eq("company_id", companyId)
    .eq("type", input.type)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const sort_order = ((maxRow?.sort_order as number | undefined) ?? -1) + 1;
  const { data, error } = await (client.from("tags") as any)
    .insert({ company_id: companyId, type: input.type, name: input.name, color: input.color ?? "#94a3b8", sort_order })
    .select("*")
    .single();
  if (error) throw error;
  return data as Tag;
}

export async function updateTag(
  id: string,
  companyId: string,
  patch: Partial<Pick<Tag, "name" | "color" | "sort_order">>
): Promise<Tag> {
  const { data, error } = await (db().from("tags") as any)
    .update(patch)
    .eq("id", id)
    .eq("company_id", companyId)
    .select("*")
    .single();
  if (error) throw error;
  return data as Tag;
}

export async function deleteTag(id: string, companyId: string): Promise<void> {
  const { error } = await (db().from("tags") as any).delete().eq("id", id).eq("company_id", companyId);
  if (error) throw error;
}

// ─── Deals ─────────────────────────────────────────────────────────────────
export async function getDeal(id: string): Promise<FunnelDeal | null> {
  const { data } = await (db().from("funnel_deals") as any).select("*").eq("id", id).maybeSingle();
  return (data as FunnelDeal | null) ?? null;
}

export async function listDealsByPipeline(pipelineId: string): Promise<FunnelDeal[]> {
  const { data, error } = await (db().from("funnel_deals") as any)
    .select("*")
    .eq("pipeline_id", pipelineId)
    .order("stage_id", { ascending: true })
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return (data as FunnelDeal[]) || [];
}

export async function createDeal(
  companyId: string,
  createdBy: string | null,
  input: {
    pipeline_id: string;
    stage_id: string;
    title: string;
    value?: number;
    currency?: string;
    conversation_id?: string | null;
    contact_id?: string | null;
    property_id?: string | null;
    expected_close_date?: string | null;
    owner_id?: string | null;
    notes?: string | null;
    sort_order?: number;
  }
): Promise<FunnelDeal> {
  const client = db();
  let sort_order = input.sort_order;
  if (sort_order === undefined) {
    const { data: maxRow } = await (client.from("funnel_deals") as any)
      .select("sort_order")
      .eq("stage_id", input.stage_id)
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    sort_order = ((maxRow?.sort_order as number | undefined) ?? 0) + 1000;
  }
  const { data, error } = await (client.from("funnel_deals") as any)
    .insert({
      company_id: companyId,
      pipeline_id: input.pipeline_id,
      stage_id: input.stage_id,
      title: input.title,
      value: input.value ?? 0,
      currency: input.currency ?? "BRL",
      conversation_id: input.conversation_id ?? null,
      contact_id: input.contact_id ?? null,
      property_id: input.property_id ?? null,
      expected_close_date: input.expected_close_date ?? null,
      owner_id: input.owner_id ?? null,
      notes: input.notes ?? null,
      sort_order: input.sort_order ?? 0,
      created_by: createdBy,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as FunnelDeal;
}

export async function updateDeal(id: string, companyId: string, patch: Record<string, unknown>): Promise<FunnelDeal> {
  const { data, error } = await (db().from("funnel_deals") as any)
    .update(patch)
    .eq("id", id)
    .eq("company_id", companyId)
    .select("*")
    .single();
  if (error) throw error;
  return data as FunnelDeal;
}

export async function deleteDeal(id: string, companyId: string): Promise<void> {
  const { error } = await (db().from("funnel_deals") as any).delete().eq("id", id).eq("company_id", companyId);
  if (error) throw error;
}

// ─── Tags M2M ──────────────────────────────────────────────────────────────
async function tagsByIds(companyId: string, ids: string[]): Promise<Map<string, Tag>> {
  if (!ids.length) return new Map();
  const { data } = await (db().from("tags") as any).select("*").eq("company_id", companyId).in("id", ids);
  const map = new Map<string, Tag>();
  for (const t of (data as Tag[]) || []) map.set(t.id, t);
  return map;
}

export async function getDealTagsMap(companyId: string, dealIds: string[]): Promise<Record<string, Tag[]>> {
  if (!dealIds.length) return {};
  const { data } = await (db().from("funnel_deal_tags") as any)
    .select("deal_id, tag_id")
    .in("deal_id", dealIds);
  const rows = (data as { deal_id: string; tag_id: string }[]) || [];
  const tagMap = await tagsByIds(companyId, [...new Set(rows.map((r) => r.tag_id))]);
  const out: Record<string, Tag[]> = {};
  for (const r of rows) {
    const tag = tagMap.get(r.tag_id);
    if (!tag) continue;
    (out[r.deal_id] ||= []).push(tag);
  }
  return out;
}

export async function setDealTags(dealId: string, tagIds: string[]): Promise<void> {
  const client = db();
  await (client.from("funnel_deal_tags") as any).delete().eq("deal_id", dealId);
  if (tagIds.length) {
    const rows = tagIds.map((tag_id) => ({ deal_id: dealId, tag_id }));
    const { error } = await (client.from("funnel_deal_tags") as any).insert(rows);
    if (error) throw error;
  }
}

export async function getConversationTagsMap(
  companyId: string,
  conversationIds: string[]
): Promise<Record<string, Tag[]>> {
  if (!conversationIds.length) return {};
  const { data } = await (db().from("conversation_tags") as any)
    .select("conversation_id, tag_id")
    .in("conversation_id", conversationIds);
  const rows = (data as { conversation_id: string; tag_id: string }[]) || [];
  const tagMap = await tagsByIds(companyId, [...new Set(rows.map((r) => r.tag_id))]);
  const out: Record<string, Tag[]> = {};
  for (const r of rows) {
    const tag = tagMap.get(r.tag_id);
    if (!tag) continue;
    (out[r.conversation_id] ||= []).push(tag);
  }
  return out;
}

export async function setConversationTags(
  conversationId: string,
  tagIds: string[],
  createdBy: string | null
): Promise<void> {
  const client = db();
  await (client.from("conversation_tags") as any).delete().eq("conversation_id", conversationId);
  if (tagIds.length) {
    const rows = tagIds.map((tag_id) => ({ conversation_id: conversationId, tag_id, created_by: createdBy }));
    const { error } = await (client.from("conversation_tags") as any).insert(rows);
    if (error) throw error;
  }
}

// ─── Board (kanban): pipeline + stages + deals (reais + virtuais) ──────────
export async function getBoard(
  companyId: string,
  type: FunnelType,
  pipelineId?: string,
  opts?: { showUnassigned?: boolean }
): Promise<BoardData> {
  const pipelines = await listPipelines(companyId, type);
  const pipeline = (pipelineId && pipelines.find((p) => p.id === pipelineId)) || pipelines.find((p) => p.is_default) || pipelines[0] || null;
  if (!pipeline) return { pipeline: null, pipelines, stages: [], deals: [] };

  const stages = await listStages(pipeline.id);
  const rawDeals = await listDealsByPipeline(pipeline.id);

  // Enriquecimento
  const convIds = [...new Set(rawDeals.map((d) => d.conversation_id).filter(Boolean) as string[])];
  const contactIds = [...new Set(rawDeals.map((d) => d.contact_id).filter(Boolean) as string[])];
  const propIds = [...new Set(rawDeals.map((d) => d.property_id).filter(Boolean) as string[])];

  const [convMap, contactMap, propMap, dealTags] = await Promise.all([
    fetchConversations(convIds),
    fetchContacts(contactIds),
    fetchProperties(propIds),
    getDealTagsMap(companyId, rawDeals.map((d) => d.id)),
  ]);

  const deals: DealCardData[] = rawDeals.map((d) => {
    const conv = d.conversation_id ? convMap.get(d.conversation_id) : null;
    const contact = d.contact_id ? contactMap.get(d.contact_id) : null;
    return {
      ...d,
      tags: dealTags[d.id] || [],
      contact_name: conv?.contact_name ?? contact?.display_name ?? null,
      contact_phone: conv?.contact_phone ?? contact?.phone_e164 ?? null,
      property_name: d.property_id ? propMap.get(d.property_id) ?? null : null,
      unread_count: conv?.unread_count ?? 0,
      last_message_at: conv?.last_message_at ?? null,
    };
  });

  // Deals virtuais: conversas nas linhas do tipo, sem negócio neste pipeline.
  const showUnassigned = opts?.showUnassigned ?? true;
  if (showUnassigned) {
    const lineIds = await listLineIdsForType(companyId, type);
    if (lineIds.length) {
      const linked = new Set(deals.map((d) => d.conversation_id).filter(Boolean) as string[]);
      const { data: convs } = await (db().from("whatsapp_conversations") as any)
        .select("id, contact_name, contact_phone, unread_count, last_message_at")
        .in("line_id", lineIds)
        .order("last_message_at", { ascending: false, nullsFirst: false })
        .limit(200);
      const unassignedConvs = ((convs as ConvLite[]) || []).filter((c) => !linked.has(c.id));
      const convTagMap = await getConversationTagsMap(companyId, unassignedConvs.map((c) => c.id));
      for (const c of unassignedConvs) {
        deals.push({
          id: `${VIRTUAL_DEAL_PREFIX}${c.id}`,
          company_id: companyId,
          pipeline_id: pipeline.id,
          stage_id: null,
          conversation_id: c.id,
          contact_id: null,
          property_id: null,
          title: c.contact_name || c.contact_phone,
          value: 0,
          currency: "BRL",
          expected_close_date: null,
          owner_id: null,
          status: "open",
          lost_reason: null,
          notes: null,
          sort_order: 0,
          created_by: null,
          created_at: c.last_message_at || new Date(0).toISOString(),
          updated_at: c.last_message_at || new Date(0).toISOString(),
          tags: convTagMap[c.id] || [],
          contact_name: c.contact_name,
          contact_phone: c.contact_phone,
          property_name: null,
          unread_count: c.unread_count ?? 0,
          last_message_at: c.last_message_at,
          virtual: true,
        });
      }
    }
  }

  return { pipeline, pipelines, stages, deals };
}

// ─── Enrichment fetch helpers ──────────────────────────────────────────────
interface ConvLite {
  id: string;
  contact_name: string | null;
  contact_phone: string;
  unread_count: number | null;
  last_message_at: string | null;
}
async function fetchConversations(ids: string[]): Promise<Map<string, ConvLite>> {
  const map = new Map<string, ConvLite>();
  if (!ids.length) return map;
  const { data } = await (db().from("whatsapp_conversations") as any)
    .select("id, contact_name, contact_phone, unread_count, last_message_at")
    .in("id", ids);
  for (const c of (data as ConvLite[]) || []) map.set(c.id, c);
  return map;
}
async function fetchContacts(ids: string[]): Promise<Map<string, { display_name: string | null; phone_e164: string | null }>> {
  const map = new Map<string, { display_name: string | null; phone_e164: string | null }>();
  if (!ids.length) return map;
  const { data } = await (db().from("whatsapp_contacts") as any).select("id, display_name, phone_e164").in("id", ids);
  for (const c of (data as { id: string; display_name: string | null; phone_e164: string | null }[]) || [])
    map.set(c.id, { display_name: c.display_name, phone_e164: c.phone_e164 });
  return map;
}
async function fetchProperties(ids: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (!ids.length) return map;
  const { data } = await (db().from("properties") as any).select("id, name").in("id", ids);
  for (const p of (data as { id: string; name: string }[]) || []) map.set(p.id, p.name);
  return map;
}
