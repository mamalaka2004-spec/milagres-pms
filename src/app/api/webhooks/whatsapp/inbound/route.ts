import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  appendMessage,
  findOrCreateConversation,
} from "@/lib/db/queries/whatsapp";
import { isOutsideBusinessHours } from "@/lib/whatsapp/auth";
import { handleCampaignInbound } from "@/lib/campaigns/inbound";
import { maybePauseOnHumanReply } from "@/lib/whatsapp/human-takeover";
import { createNotification } from "@/lib/notifications/create";
import { rehostInboundMedia } from "@/lib/whatsapp/media";
import { inboundWebhookSchema } from "@/lib/validations/whatsapp";
import {
  apiSuccess,
  apiError,
  apiServerError,
} from "@/lib/api/response";
import type { Database } from "@/types/database";
import { timingSafeEqual } from "node:crypto";

type LineRow = Database["public"]["Tables"]["whatsapp_lines"]["Row"];

export const maxDuration = 60;

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

export async function POST(request: NextRequest) {
  try {
    const expected = process.env.WHATSAPP_WEBHOOK_SECRET;
    if (!expected) return apiError("Webhook not configured", 503);
    const provided = request.headers.get("x-webhook-secret") || "";
    if (!safeEqual(provided, expected)) return apiError("Forbidden", 403);

    const body = await request.json();
    const validation = inboundWebhookSchema.safeParse(body);
    if (!validation.success) return apiError("Validation failed", 400, validation.error.flatten());
    const payload = validation.data;
    const linePhone = payload.line_phone.startsWith("+") ? payload.line_phone : `+${payload.line_phone}`;
    const contactPhone = payload.contact_phone.startsWith("+") ? payload.contact_phone : `+${payload.contact_phone}`;

    // Resolve line by phone. We expect at most one match (in v1 each WhatsApp number
    // belongs to a single Milagres tenant) — if multiple, something is misconfigured
    // and we refuse rather than guess.
    const supabase = createAdminClient();
    const { data: lineRows, error: lineErr } = await supabase
      .from("whatsapp_lines")
      .select("*")
      .eq("phone", linePhone)
      .limit(2);
    if (lineErr) throw lineErr;
    const lines = (lineRows as LineRow[]) || [];
    if (lines.length === 0) return apiError("Line not registered", 404);
    if (lines.length > 1) return apiError("Ambiguous line — phone in multiple tenants", 409);
    const line = lines[0];
    if (!line.is_active) return apiError("Line is inactive", 410);

    // System-level (company) AI master switch — top of the hierarchy. When off, the AI
    // never auto-replies regardless of per-line / per-conversation settings.
    const { data: companyRow } = await supabase
      .from("companies")
      .select("ai_enabled")
      .eq("id", line.company_id)
      .maybeSingle();
    const aiMasterEnabled = (companyRow as { ai_enabled?: boolean } | null)?.ai_enabled === true;

    const conv = await findOrCreateConversation({
      companyId: line.company_id,
      lineId: line.id,
      contactPhone,
      contactName: payload.contact_name ?? null,
    });

    // Inbound media arrives as an encrypted WhatsApp CDN URL (mmg.whatsapp.net/…),
    // which the browser can't render. Download + decrypt it via Evolution and re-host
    // on our public bucket so it displays in the chat. Falls back to the original URL.
    let mediaUrl = payload.media_url ?? null;
    let mediaMime = payload.media_mime_type ?? null;
    let fileName = payload.file_name ?? null;
    const isMedia = ["image", "audio", "video", "document"].includes(payload.message_type);
    if (isMedia && payload.external_id && line.provider === "evolution" && line.provider_instance) {
      const rehosted = await rehostInboundMedia({
        externalId: payload.external_id,
        conversationId: conv.id,
        instance: line.provider_instance,
        apiKey: line.provider_token || undefined,
      });
      if (rehosted) {
        mediaUrl = rehosted.url;
        mediaMime = rehosted.mime || mediaMime;
        fileName = rehosted.fileName || fileName;
      }
    }

    // fromMe = the operator sent this from the WhatsApp app on the phone itself. Mirror
    // it into the CRM as an outbound/agent message so the thread matches WhatsApp. (CRM-
    // sent messages echo back here too, but dedup on external_id keeps them single.)
    const fromMe = payload.from_me === true;

    const message = await appendMessage({
      conversationId: conv.id,
      direction: fromMe ? "outbound" : "inbound",
      sender: fromMe ? "agent" : "guest",
      text: payload.text ?? null,
      messageType: payload.message_type,
      mediaUrl,
      mediaMimeType: mediaMime,
      fileName,
      externalId: payload.external_id ?? null,
      status: fromMe ? "sent" : undefined,
      bumpUnread: !fromMe,
    });

    // Takeover humano: alguém do time respondeu direto pelo WhatsApp → pausa a
    // IA desta conversa (com guardas para não confundir com o eco da própria
    // IA). Nunca derruba o webhook.
    let humanTookOver = false;
    if (fromMe) {
      try {
        humanTookOver = await maybePauseOnHumanReply({
          companyId: line.company_id,
          conversationId: conv.id,
          contactPhone,
          aiActive: conv.ai_active === true,
          message,
        });
      } catch (e) {
        console.error("[inbound] human-takeover check failed:", e);
      }
    }

    // Resposta de destinatário de campanha: para a cadência, trata opt-out por
    // keyword e marca o lead como prospecção fria. Nunca derruba o webhook.
    let cameFromCampaign = false;
    let campaignOptOut = false;
    if (!fromMe) {
      try {
        const res = await handleCampaignInbound({
          companyId: line.company_id,
          conversationId: conv.id,
          contactPhone,
          text: payload.text ?? null,
          line: { provider_instance: line.provider_instance, provider_token: line.provider_token },
        });
        cameFromCampaign = res.cameFromCampaign;
        campaignOptOut = res.optedOut;
      } catch (e) {
        console.error("[inbound] campaign handling failed:", e);
      }
    }

    // In-app notification (#18): alerta a equipe sobre nova mensagem recebida.
    // Fire-and-forget — nunca deve derrubar o webhook.
    if (!fromMe) {
      const who = payload.contact_name?.trim() || contactPhone;
      const preview =
        payload.text?.trim() ||
        (isMedia ? `[${payload.message_type}]` : "Nova mensagem");
      await createNotification({
        companyId: line.company_id,
        type: "whatsapp.message",
        title: `Nova mensagem de ${who}`,
        body: preview.length > 120 ? `${preview.slice(0, 117)}…` : preview,
        entityType: "whatsapp_conversation",
        entityId: conv.id,
        link: "/conversations",
      });
    }

    // Decide whether the AI should auto-reply (n8n calls /api/whatsapp/ai-reply if true).
    // Never auto-reply to our own outgoing messages.
    // Conversas vindas de campanha: a IA responde MESMO em horário comercial
    // (override só para respostas de campanha); opt-out silencia a IA.
    const aiShouldRespond =
      !fromMe &&
      !campaignOptOut &&
      aiMasterEnabled &&
      line.ai_enabled &&
      conv.ai_active &&
      conv.status === "open" &&
      (isOutsideBusinessHours(line.business_hours) || cameFromCampaign);

    return apiSuccess({
      conversation_id: conv.id,
      message_id: message.id,
      human_took_over: humanTookOver,
      ai_should_respond: aiShouldRespond,
      came_from_campaign: cameFromCampaign,
      campaign_opt_out: campaignOptOut,
    });
  } catch (error) {
    return apiServerError(error);
  }
}
