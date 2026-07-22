/* eslint-disable @typescript-eslint/no-explicit-any */
// ===========================================================================
// Campanhas + destinatários — query layer
// Disparo pelo worker campaign-tick (edge function + pg_cron); aqui vive o
// enqueue (fila + scheduled_for), steps de cadência e progresso/contadores.
// ===========================================================================
import { createAdminClient } from "@/lib/supabase/admin";
import { canonicalBR } from "@/lib/whatsapp/phone";
import { createDeal } from "@/lib/db/queries/funnel";
import { getContactsByIds } from "@/lib/db/queries/contacts";
import { listMemberContactIds } from "@/lib/db/queries/contact-lists";
import { nextSlot, randInt, windowIsValid, describeWindow } from "@/lib/campaigns/schedule";
import type {
  Campaign,
  CampaignRecipient,
  CampaignStatus,
  CampaignStep,
  RecipientStatus,
  ContactLite,
} from "@/types/campaign";

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

const ANTIBAN_FIELDS = [
  "min_interval_seconds",
  "max_interval_seconds",
  "daily_limit",
  "hourly_limit",
  "schedule",
  "simulate_typing",
  "typing_seconds_min",
  "typing_seconds_max",
  "opt_out_keywords",
  "skip_active_conversations",
  "audience",
] as const;

export async function createCampaign(
  companyId: string,
  createdBy: string | null,
  input: Record<string, unknown>
): Promise<Campaign> {
  const row: Record<string, unknown> = {
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
  };
  for (const f of ANTIBAN_FIELDS) if (input[f] !== undefined) row[f] = input[f];
  const { data, error } = await (db().from("campaigns") as any)
    .insert(row)
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

/** Recalcula sent/failed e finaliza a campanha quando não há mais pendentes. */
export async function refreshCampaignProgress(campaignId: string): Promise<void> {
  const client = db();
  const countBy = async (statuses: RecipientStatus[]): Promise<number> => {
    const { count } = await (client.from("campaign_recipients") as any)
      .select("id", { count: "exact", head: true })
      .eq("campaign_id", campaignId)
      .in("status", statuses);
    return count ?? 0;
  };
  const [sent, failed, active, total] = await Promise.all([
    countBy(["sent", "delivered", "replied"]),
    countBy(["failed"]),
    countBy(["pending", "sending"]),
    countBy(["pending", "sending", "sent", "delivered", "failed", "skipped", "replied", "opted_out"]),
  ]);
  const patch: Record<string, unknown> = { sent_count: sent, failed_count: failed };
  if (active === 0 && total > 0 && sent + failed > 0) {
    patch.status = failed === sent + failed ? "failed" : "sent";
    patch.finished_at = new Date().toISOString();
  }
  await (client.from("campaigns") as any).update(patch).eq("id", campaignId);
}

// ─── Steps (cadência) ──────────────────────────────────────────────────────
export async function listSteps(campaignId: string): Promise<CampaignStep[]> {
  const { data, error } = await (db().from("campaign_steps") as any)
    .select("*")
    .eq("campaign_id", campaignId)
    .order("order_index", { ascending: true });
  if (error) throw error;
  return (data as CampaignStep[]) || [];
}

/** Compat 024: campanhas criadas só com message_template ganham o passo 0. */
export async function ensureStepFromTemplate(campaign: Campaign): Promise<CampaignStep[]> {
  const steps = await listSteps(campaign.id);
  if (steps.length > 0) return steps;
  if (!campaign.message_template && !campaign.media_url) return [];
  const { error } = await (db().from("campaign_steps") as any).insert({
    campaign_id: campaign.id,
    order_index: 0,
    kind: "template",
    body: campaign.message_template || null,
    media_url: campaign.media_url,
    media_mime_type: campaign.media_mime_type,
  });
  if (error) throw error;
  return listSteps(campaign.id);
}

/** Substitui todos os passos da campanha (replace-all, ordem = índice). */
export async function replaceSteps(
  campaignId: string,
  steps: Array<Record<string, unknown>>
): Promise<CampaignStep[]> {
  const client = db();
  const { error: delErr } = await (client.from("campaign_steps") as any)
    .delete()
    .eq("campaign_id", campaignId);
  if (delErr) throw delErr;
  if (steps.length) {
    const rows = steps.map((s, i) => ({
      campaign_id: campaignId,
      order_index: i,
      kind: s.kind,
      body: s.body ?? null,
      ai_prompt: s.ai_prompt ?? null,
      media_url: s.media_url ?? null,
      media_mime_type: s.media_mime_type ?? null,
      wait_hours: s.wait_hours ?? 0,
      variant: s.variant ?? "A",
    }));
    const { error } = await (client.from("campaign_steps") as any).insert(rows);
    if (error) throw error;
  }
  return listSteps(campaignId);
}

// ─── Enqueue (substitui o disparo via n8n) ─────────────────────────────────
// Prepara a fila para o worker campaign-tick (edge function + pg_cron):
// resolve audiência de listas, filtra opt-out e conversas ativas, preenche
// variáveis e distribui scheduled_for com gap randômico dentro da janela.
export async function enqueueCampaign(
  campaign: Campaign,
  opts: { scheduledAt?: string | null; listIds?: string[] } = {}
): Promise<{ queued: number; skipped: number }> {
  const client = db();

  // Guard: janela invertida/vazia nunca contém instante algum — sem isto os
  // destinatários seriam agendados para uma data distante e a campanha ficaria
  // parada sem explicação.
  if (!windowIsValid(campaign.schedule)) {
    throw new Error(
      `Janela de envio inválida (${describeWindow(campaign.schedule)}). O horário final precisa ser maior que o inicial.`
    );
  }

  // Audiência extra vinda de listas salvas.
  if (opts.listIds?.length) {
    const contactIds = await listMemberContactIds(opts.listIds);
    const contacts = await getContactsByIds(campaign.company_id, contactIds);
    await addRecipientsFromContacts(campaign.id, contacts);
  }

  const recipients = (await listRecipients(campaign.id)).filter((r) => r.status === "pending");
  if (recipients.length === 0) return { queued: 0, skipped: 0 };

  // Opt-out (LGPD): nunca enviar para do_not_contact.
  const canonicals = [...new Set(recipients.map((r) => r.phone_canonical).filter(Boolean))];
  const optedOut = new Set<string>();
  for (let i = 0; i < canonicals.length; i += 200) {
    const { data } = await (client.from("whatsapp_contacts") as any)
      .select("phone_canonical")
      .eq("company_id", campaign.company_id)
      .eq("do_not_contact", true)
      .in("phone_canonical", canonicals.slice(i, i + 200));
    for (const row of (data as { phone_canonical: string }[]) || []) optedOut.add(row.phone_canonical);
  }

  // Conversas ativas (proxy: aberta com movimento nos últimos 7 dias) — não
  // atropelar atendimento/negociação em andamento.
  const activePhones = new Set<string>();
  if (campaign.skip_active_conversations && campaign.line_id) {
    const phones = [...new Set(recipients.map((r) => (r.phone_e164.startsWith("+") ? r.phone_e164 : `+${r.phone_e164}`)))];
    const since = new Date(Date.now() - 7 * 24 * 60 * 60_000).toISOString();
    for (let i = 0; i < phones.length; i += 200) {
      const { data } = await (client.from("whatsapp_conversations") as any)
        .select("contact_phone")
        .eq("line_id", campaign.line_id)
        .eq("status", "open")
        .gte("last_message_at", since)
        .in("contact_phone", phones.slice(i, i + 200));
      for (const row of (data as { contact_phone: string }[]) || []) activePhones.add(row.contact_phone);
    }
  }

  // Distribuição de scheduled_for: gap randômico dentro da janela.
  const schedule = campaign.schedule;
  const startAt = opts.scheduledAt ? new Date(opts.scheduledAt) : new Date();
  let cursor = nextSlot(startAt.getTime() > Date.now() ? startAt : new Date(), schedule);
  if (!cursor) {
    throw new Error(
      `Sem horário válido nos próximos 14 dias para a janela ${describeWindow(schedule)}.`
    );
  }

  let queued = 0;
  let skipped = 0;
  const updates: Promise<unknown>[] = [];
  for (const r of recipients) {
    const phonePlus = r.phone_e164.startsWith("+") ? r.phone_e164 : `+${r.phone_e164}`;
    const isOptOut = !!r.phone_canonical && optedOut.has(r.phone_canonical);
    const isActive = activePhones.has(phonePlus);
    if (isOptOut || isActive) {
      skipped++;
      updates.push(
        (client.from("campaign_recipients") as any)
          .update({
            status: "skipped",
            error: isOptOut ? "opt-out (não contatar)" : "conversa ativa nos últimos 7 dias",
          })
          .eq("id", r.id)
      );
      continue;
    }
    const nome = (r.name || "").trim();
    updates.push(
      (client.from("campaign_recipients") as any)
        .update({
          scheduled_for: cursor.toISOString(),
          current_step: 0,
          attempts: 0,
          error: null,
          variables: {
            nome: nome || "",
            primeiro_nome: nome.split(/\s+/)[0] || "",
            telefone: phonePlus,
          },
        })
        .eq("id", r.id)
    );
    queued++;
    // Avança o cursor pelo gap randômico, reancorando na janela. Se a fila for
    // tão longa que passe de 14 dias, mantém o último horário válido (os
    // últimos saem juntos no fim da janela) em vez de sumir do calendário.
    const next = nextSlot(
      new Date(
        cursor.getTime() +
          randInt(campaign.min_interval_seconds || 30, campaign.max_interval_seconds || 90) * 1000
      ),
      schedule
    );
    if (next) cursor = next;
  }
  // Em lotes para não abrir centenas de conexões simultâneas.
  for (let i = 0; i < updates.length; i += 20) {
    await Promise.all(updates.slice(i, i + 20));
  }

  await setCampaignStatus(campaign.id, "scheduled", {
    scheduled_at: opts.scheduledAt ?? null,
    audience: opts.listIds?.length ? { list_ids: opts.listIds } : campaign.audience,
    finished_at: null,
  });
  await recomputeTotal(campaign.id);
  return { queued, skipped };
}

// ─── Métricas (página de detalhe) ──────────────────────────────────────────
export interface CampaignMetrics {
  totals: {
    total: number;
    queued: number; // pending + sending
    reached: number; // sent + delivered + replied (recebeu ≥1 mensagem)
    delivered: number; // delivered_at preenchido
    read: number; // read_at preenchido
    replied: number;
    opted_out: number;
    failed: number;
    skipped: number;
  };
  rates: { delivery: number; read: number; response: number };
  daily: { day: string; enviadas: number; respostas: number }[];
  steps: {
    step_id: string | null;
    order_index: number;
    kind: string;
    label: string;
    sent: number;
    delivered: number;
    read: number;
  }[];
}

export async function getCampaignMetrics(campaignId: string): Promise<CampaignMetrics> {
  const client = db();
  const [{ data: recData }, { data: msgData }, steps] = await Promise.all([
    (client.from("campaign_recipients") as any)
      .select("status, delivered_at, read_at, replied_at")
      .eq("campaign_id", campaignId)
      .limit(5000),
    (client.from("campaign_messages") as any)
      .select("step_id, sent_at, delivered_at, read_at")
      .eq("campaign_id", campaignId)
      .limit(5000),
    listSteps(campaignId),
  ]);
  const recs = (recData as any[]) || [];
  const msgs = (msgData as any[]) || [];

  const by = (fn: (r: any) => boolean) => recs.filter(fn).length;
  const totals = {
    total: recs.length,
    queued: by((r) => r.status === "pending" || r.status === "sending"),
    reached: by((r) => ["sent", "delivered", "replied"].includes(r.status)),
    delivered: by((r) => !!r.delivered_at),
    read: by((r) => !!r.read_at),
    replied: by((r) => r.status === "replied"),
    opted_out: by((r) => r.status === "opted_out"),
    failed: by((r) => r.status === "failed"),
    skipped: by((r) => r.status === "skipped"),
  };
  // opted_out também recebeu mensagem antes de sair.
  totals.reached += totals.opted_out;

  const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 100) : 0);
  const rates = {
    delivery: pct(totals.delivered, totals.reached),
    read: pct(totals.read, totals.reached),
    response: pct(totals.replied, totals.reached),
  };

  // Série diária: envios (campaign_messages) × respostas (replied_at).
  const dayMap = new Map<string, { enviadas: number; respostas: number }>();
  const bump = (iso: string | null, field: "enviadas" | "respostas") => {
    if (!iso) return;
    const day = iso.slice(0, 10);
    const cur = dayMap.get(day) ?? { enviadas: 0, respostas: 0 };
    cur[field]++;
    dayMap.set(day, cur);
  };
  for (const m of msgs) bump(m.sent_at, "enviadas");
  for (const r of recs) bump(r.replied_at, "respostas");
  const daily = [...dayMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, v]) => ({ day, ...v }));

  // Por passo da cadência.
  const stepRows = steps.map((s, i) => {
    const ofStep = msgs.filter((m) => m.step_id === s.id);
    return {
      step_id: s.id,
      order_index: s.order_index,
      kind: s.kind,
      label: i === 0 ? "Mensagem inicial" : `Follow-up ${i}`,
      sent: ofStep.length,
      delivered: ofStep.filter((m) => !!m.delivered_at).length,
      read: ofStep.filter((m) => !!m.read_at).length,
    };
  });

  return { totals, rates, daily, steps: stepRows };
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
