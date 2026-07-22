/* eslint-disable @typescript-eslint/no-explicit-any */
// ===========================================================================
// Resposta de destinatário de campanha (chamado pelo webhook inbound).
//
// - Resposta normal → cadência PARA (recipient 'replied') e a Sarah assume a
//   conversa (o webhook faz override do gate de horário p/ conversas vindas
//   de campanha).
// - Opt-out por palavra-chave ("sair", "parar"…) → contato marcado
//   do_not_contact (LGPD), recipients 'opted_out', confirmação curta enviada
//   e IA desligada na conversa.
// ===========================================================================
import { createAdminClient } from "@/lib/supabase/admin";
import { canonicalBR } from "@/lib/whatsapp/phone";
import { sendText } from "@/lib/whatsapp/evolution";

const OPT_OUT_CONFIRMATION = "Tudo bem, você não receberá mais mensagens. 👍";
/** Recipient ainda "vivo" numa campanha (cadência ativa ou já contatado). */
const ACTIVE_RECIPIENT_STATUSES = ["pending", "sending", "sent", "delivered"];

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Opt-out = mensagem curta (≤4 palavras) contendo uma keyword da campanha. */
function isOptOut(text: string, keywords: string[]): boolean {
  const norm = normalize(text);
  if (!norm || norm.split(" ").length > 4) return false;
  return keywords.some((k) => {
    const kw = normalize(k);
    return kw.length > 0 && norm.includes(kw);
  });
}

export interface CampaignInboundResult {
  cameFromCampaign: boolean;
  optedOut: boolean;
}

export async function handleCampaignInbound(opts: {
  companyId: string;
  conversationId: string;
  contactPhone: string; // E.164 com "+"
  text: string | null;
  line: { provider_instance: string | null; provider_token: string | null };
}): Promise<CampaignInboundResult> {
  const none: CampaignInboundResult = { cameFromCampaign: false, optedOut: false };
  const canonical = canonicalBR(opts.contactPhone);
  if (!canonical) return none;

  const db = createAdminClient();
  const { data } = await (db.from("campaign_recipients") as any)
    .select(
      "id, campaign_id, status, replied_at, opted_out_at, contact_id, campaign:campaigns!inner(id, company_id, opt_out_keywords, replied_count, opted_out_count, status)"
    )
    .eq("phone_canonical", canonical)
    .eq("campaign.company_id", opts.companyId)
    .in("status", ACTIVE_RECIPIENT_STATUSES)
    .is("replied_at", null)
    .is("opted_out_at", null);
  const recipients = ((data as any[]) || []).filter((r) => r.campaign?.status !== "cancelled");
  if (recipients.length === 0) return none;

  const nowIso = new Date().toISOString();
  const keywords = [...new Set(recipients.flatMap((r) => r.campaign?.opt_out_keywords ?? []))];
  const optedOut = !!opts.text && isOptOut(opts.text, keywords);

  // Contadores por campanha (1x por campanha distinta).
  const byCampaign = new Map<string, any>();
  for (const r of recipients) byCampaign.set(r.campaign_id, r.campaign);

  if (optedOut) {
    await (db.from("whatsapp_contacts") as any)
      .update({ do_not_contact: true, opted_out_at: nowIso, opt_out_source: "keyword" })
      .eq("company_id", opts.companyId)
      .eq("phone_canonical", canonical);
    await (db.from("campaign_recipients") as any)
      .update({ status: "opted_out", opted_out_at: nowIso })
      .in("id", recipients.map((r) => r.id));
    for (const [campaignId, camp] of byCampaign) {
      await (db.from("campaigns") as any)
        .update({ opted_out_count: (camp?.opted_out_count ?? 0) + 1 })
        .eq("id", campaignId);
    }
    // IA fora desta conversa — pedido explícito de silêncio.
    await (db.from("whatsapp_conversations") as any)
      .update({ ai_active: false })
      .eq("id", opts.conversationId);
    // Sarah roda no n8n com gate próprio via Redis — pausa pelo mesmo webhook
    // de controle usado em /api/sales/conversations/[id]/ai-control (best-effort).
    const ctrlUrl = process.env.WHATSAPP_AI_CONTROL_WEBHOOK_URL;
    const ctrlSecret = process.env.WHATSAPP_WEBHOOK_SECRET;
    if (ctrlUrl && ctrlSecret) {
      try {
        await fetch(ctrlUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Webhook-Secret": ctrlSecret },
          body: JSON.stringify({
            action: "pause",
            contact_phone: opts.contactPhone,
            conversation_id: opts.conversationId,
          }),
        });
      } catch (e) {
        console.warn("[campaign-inbound] pausa da IA (n8n) falhou:", (e as Error).message);
      }
    }
    // Confirmação curta (best-effort — nunca derruba o webhook).
    try {
      await sendText(
        opts.contactPhone,
        OPT_OUT_CONFIRMATION,
        opts.line.provider_instance || undefined,
        opts.line.provider_token || undefined
      );
    } catch (e) {
      console.warn("[campaign-inbound] confirmação de opt-out falhou:", (e as Error).message);
    }
    return { cameFromCampaign: true, optedOut: true };
  }

  // Resposta normal: cadência para; Sarah assume (gate no webhook).
  await (db.from("campaign_recipients") as any)
    .update({ status: "replied", replied_at: nowIso })
    .in("id", recipients.map((r) => r.id));
  for (const [campaignId, camp] of byCampaign) {
    await (db.from("campaigns") as any)
      .update({ replied_count: (camp?.replied_count ?? 0) + 1 })
      .eq("id", campaignId);
  }

  // Lead veio de prospecção fria — contexto para a Sarah e para o funil.
  const { data: lead } = await (db.from("whatsapp_lead_data") as any)
    .select("conversation_id, origem")
    .eq("conversation_id", opts.conversationId)
    .maybeSingle();
  if (!lead) {
    await (db.from("whatsapp_lead_data") as any).insert({
      conversation_id: opts.conversationId,
      origem: "prospeccao_fria",
      lead_stage: "apresentacao",
    });
  } else if (!lead.origem) {
    await (db.from("whatsapp_lead_data") as any)
      .update({ origem: "prospeccao_fria" })
      .eq("conversation_id", opts.conversationId);
  }

  return { cameFromCampaign: true, optedOut: false };
}
