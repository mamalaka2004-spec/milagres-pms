/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { apiSuccess, apiError, apiServerError } from "@/lib/api/response";

/**
 * Eventos de status de mensagem da Evolution (MESSAGES_UPDATE), via n8n.
 * Autenticado por x-webhook-secret (mesmo segredo do inbound).
 *
 * Aceita o status já mapeado (delivered|read) ou o cru da Evolution
 * (SERVER_ACK|DELIVERY_ACK|READ|PLAYED). Atualiza whatsapp_messages e, quando
 * a mensagem é de campanha, os timestamps/contadores de campaign_messages,
 * campaign_recipients e campaigns.
 */
const statusSchema = z.object({
  external_id: z.string().min(4).max(200),
  status: z.string().min(2).max(30),
});

const STATUS_MAP: Record<string, "delivered" | "read" | null> = {
  delivered: "delivered",
  read: "read",
  delivery_ack: "delivered",
  server_ack: null, // chegou ao servidor — não nos interessa
  played: "read",
};

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

    const parsed = statusSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) return apiError("Payload inválido", 400, parsed.error.flatten());
    const { external_id } = parsed.data;
    const status = STATUS_MAP[parsed.data.status.toLowerCase()];
    if (status === undefined) return apiError(`Status desconhecido: ${parsed.data.status}`, 400);
    if (status === null) return apiSuccess({ ignored: true });

    const db = createAdminClient();
    const nowIso = new Date().toISOString();

    // Inbox: só "sobe" o status (sent → delivered → read; nunca rebaixa).
    const rank: Record<string, number> = { pending: 0, sent: 1, delivered: 2, read: 3, failed: 0 };
    const { data: msgs } = await (db.from("whatsapp_messages") as any)
      .select("id, status")
      .eq("external_id", external_id);
    for (const m of (msgs as { id: string; status: string }[]) || []) {
      if ((rank[m.status] ?? 0) < rank[status]) {
        await (db.from("whatsapp_messages") as any).update({ status }).eq("id", m.id);
      }
    }

    // Campanha: timestamps por passo + primeiro delivered/read do recipient.
    const { data: cm } = await (db.from("campaign_messages") as any)
      .select("id, campaign_id, recipient_id, delivered_at, read_at")
      .eq("external_id", external_id)
      .maybeSingle();
    if (cm) {
      const field = status === "read" ? "read_at" : "delivered_at";
      if (!cm[field]) {
        await (db.from("campaign_messages") as any).update({ [field]: nowIso }).eq("id", cm.id);
      }
      const { data: rec } = await (db.from("campaign_recipients") as any)
        .select("id, delivered_at, read_at")
        .eq("id", cm.recipient_id)
        .maybeSingle();
      if (rec && !rec[field]) {
        await (db.from("campaign_recipients") as any).update({ [field]: nowIso }).eq("id", rec.id);
        // Primeiro delivered/read deste destinatário → contador da campanha.
        const counter = status === "read" ? "read_count" : "delivered_count";
        const { data: camp } = await (db.from("campaigns") as any)
          .select(`id, ${counter}`)
          .eq("id", cm.campaign_id)
          .maybeSingle();
        if (camp) {
          await (db.from("campaigns") as any)
            .update({ [counter]: ((camp as any)[counter] ?? 0) + 1 })
            .eq("id", cm.campaign_id);
        }
      }
      // "read" implica "delivered" — preenche se o DELIVERY_ACK se perdeu.
      if (status === "read" && rec && !rec.delivered_at) {
        await (db.from("campaign_recipients") as any)
          .update({ delivered_at: nowIso })
          .eq("id", rec.id);
      }
    }

    return apiSuccess({ ok: true, status, campaign: !!cm });
  } catch (error) {
    return apiServerError(error);
  }
}
