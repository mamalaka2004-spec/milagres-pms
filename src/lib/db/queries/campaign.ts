/* eslint-disable @typescript-eslint/no-explicit-any */
// ===========================================================================
// Campanhas + destinatários — query layer (Fase 2 / Etapa B)
// Disparo orquestrado pelo n8n; aqui só persistimos estado + contadores.
// ===========================================================================
import { createAdminClient } from "@/lib/supabase/admin";
import { canonicalBR } from "@/lib/whatsapp/phone";
import { createDeal } from "@/lib/db/queries/funnel";
import { getContactsByIds } from "@/lib/db/queries/contacts";
import type { Campaign, CampaignRecipient, CampaignStatus, RecipientStatus, ContactLite } from "@/types/campaign";

function db() {
  return createAdminClient();
}

// ─── Campaigns CRUD ────────────────────────────────────────────────────────
export async function listCampaigns(companyId: string): Promise<Campaign[]> {
  const { data, error } = await (db().from("campaigns") as any)
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data as Campaign[]) || [];
}

export async function getCampaign(id: string): Promise<Campaign | null> {
  const { data } = await (db().from("campaigns") as any).select("*").eq("id", id).maybeSingle();
  return (data as Campaign | null) ?? null;
}

export async function createCampaign(
  companyId: string,
  createdBy: string | null,
  input: Record<string, unknown>
): Promise<Campaign> {
  const { data, error } = await (db().from("campaigns") as any)
    .insert({
      company_id: companyId,
      name: input.name,
      line_id: input.line_id ?? null,
      message_template: input.message_template,
      media_url: input.media_url ?? null,
      media_mime_type: input.media_mime_type ?? null,
      throttle_seconds: input.throttle_seconds ?? 30,
      target_pipeline_id: input.target_pipeline_id ?? null,
      target_stage_id: input.target_stage_id ?? null,
      scheduled_at: input.scheduled_at ?? null,
      status: "draft",
      created_by: createdBy,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as Campaign;
}

export async function updateCampaign(id: string, companyId: string, patch: Record<string, unknown>): Promise<Campaign> {
  const { data, error } = await (db().from("campaigns") as any)
    .update(patch)
    .eq("id", id)
    .eq("company_id", companyId)
    .select("*")
    .single();
  if (error) throw error;
  return data as Campaign;
}

export async function deleteCampaign(id: string, companyId: string): Promise<void> {
  const { error } = await (db().from("campaigns") as any).delete().eq("id", id).eq("company_id", companyId);
  if (error) throw error;
}

// ─── Recipients ────────────────────────────────────────────────────────────
export async function listRecipients(campaignId: string): Promise<CampaignRecipient[]> {
  const { data, error } = await (db().from("campaign_recipients") as any)
    .select("*")
    .eq("campaign_id", campaignId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data as CampaignRecipient[]) || [];
}

export async function recomputeTotal(campaignId: string): Promise<number> {
  const { count } = await (db().from("campaign_recipients") as any)
    .select("id", { count: "exact", head: true })
    .eq("campaign_id", campaignId);
  const total = count ?? 0;
  await (db().from("campaigns") as any).update({ total_count: total }).eq("id", campaignId);
  return total;
}

export async function addRecipientsFromContacts(campaignId: string, contacts: ContactLite[]): Promise<number> {
  const rows = contacts
    .map((c) => {
      const canonical = c.phone_canonical || canonicalBR(c.phone_e164);
      if (!canonical) return null; // sem telefone confiável — pula
      return {
        campaign_id: campaignId,
        contact_id: c.id,
        phone_e164: c.phone_e164 || canonical,
        phone_canonical: canonical,
        name: c.display_name,
        status: "pending" as RecipientStatus,
      };
    })
    .filter(Boolean);
  if (rows.length) {
    await (db().from("campaign_recipients") as any).upsert(rows, {
      onConflict: "campaign_id,phone_canonical",
      ignoreDuplicates: true,
    });
  }
  return recomputeTotal(campaignId);
}

export async function addRecipientsFromPhones(
  campaignId: string,
  phones: { phone: string; name?: string }[]
): Promise<number> {
  const rows = phones
    .map((p) => {
      const canonical = canonicalBR(p.phone);
      if (!canonical) return null;
      return {
        campaign_id: campaignId,
        phone_e164: p.phone,
        phone_canonical: canonical,
        name: p.name ?? null,
        status: "pending" as RecipientStatus,
      };
    })
    .filter(Boolean);
  if (rows.length) {
    await (db().from("campaign_recipients") as any).upsert(rows, {
      onConflict: "campaign_id,phone_canonical",
      ignoreDuplicates: true,
    });
  }
  return recomputeTotal(campaignId);
}

export async function removeRecipient(campaignId: string, recipientId: string): Promise<void> {
  await (db().from("campaign_recipients") as any).delete().eq("id", recipientId).eq("campaign_id", campaignId);
  await recomputeTotal(campaignId);
}

export async function clearRecipients(campaignId: string): Promise<void> {
  await (db().from("campaign_recipients") as any).delete().eq("campaign_id", campaignId);
  await recomputeTotal(campaignId);
}

// ─── Status / envio ────────────────────────────────────────────────────────
export async function setCampaignStatus(
  id: string,
  status: CampaignStatus,
  extra: Record<string, unknown> = {}
): Promise<void> {
  await (db().from("campaigns") as any).update({ status, ...extra }).eq("id", id);
}

/** Callback do n8n: atualiza um destinatário e reprocessa contadores/estado. */
export async function updateRecipientStatus(
  campaignId: string,
  recipientId: string,
  status: RecipientStatus,
  extra: { external_id?: string | null; error?: string | null } = {}
): Promise<void> {
  const patch: Record<string, unknown> = { status };
  if (extra.external_id !== undefined) patch.external_id = extra.external_id;
  if (extra.error !== undefined) patch.error = extra.error;
  if (status === "sent" || status === "delivered") patch.sent_at = new Date().toISOString();
  await (db().from("campaign_recipients") as any).update(patch).eq("id", recipientId).eq("campaign_id", campaignId);
  await refreshCampaignProgress(campaignId);
}

/** Recalcula sent/failed e finaliza a campanha quando não há mais pendentes.
 *  Usa contagens (head) — o n8n chama isto uma vez por destinatário. */
export async function refreshCampaignProgress(campaignId: string): Promise<void> {
  const client = db();
  const countBy = async (statuses: RecipientStatus[]): Promise<number> => {
    const { count } = await (client.from("campaign_recipients") as any)
      .select("id", { count: "exact", head: true })
      .eq("campaign_id", campaignId)
      .in("status", statuses);
    return count ?? 0;
  };
  const [sent, failed, pending, total] = await Promise.all([
    countBy(["sent", "delivered"]),
    countBy(["failed"]),
    countBy(["pending", "sending"]),
    countBy(["pending", "sending", "sent", "delivered", "failed", "skipped"]),
  ]);
  const patch: Record<string, unknown> = { sent_count: sent, failed_count: failed };
  if (pending === 0 && total > 0) {
    patch.status = failed === total ? "failed" : "sent";
    patch.finished_at = new Date().toISOString();
  }
  await (client.from("campaigns") as any).update(patch).eq("id", campaignId);
}

// ─── Prospecção cross-base: contatos → etapa de funil (cria deals) ─────────
export async function assignContactsToStage(
  companyId: string,
  createdBy: string | null,
  pipelineId: string,
  stageId: string,
  contactIds: string[]
): Promise<number> {
  const contacts = await getContactsByIds(companyId, contactIds);
  let created = 0;
  for (const c of contacts) {
    await createDeal(companyId, createdBy, {
      pipeline_id: pipelineId,
      stage_id: stageId,
      title: c.display_name || c.phone_e164 || "Contato",
      contact_id: c.id,
    });
    created++;
  }
  return created;
}
