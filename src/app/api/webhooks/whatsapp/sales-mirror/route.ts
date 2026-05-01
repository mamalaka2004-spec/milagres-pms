import { NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { appendMessage, findOrCreateConversation } from "@/lib/db/queries/whatsapp";
import { upsertLeadData } from "@/lib/db/queries/sales";
import { outboundMirrorSchema } from "@/lib/validations/sales";
import { apiSuccess, apiError, apiServerError } from "@/lib/api/response";
import type { Database } from "@/types/database";

type LineRow = Database["public"]["Tables"]["whatsapp_lines"]["Row"];

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

/**
 * Sales mirror endpoint — called by the n8n `Milagres Completo` workflow
 * AFTER it sends an outbound message via Evolution. We persist the AI's
 * reply as a `sender='ai'` message in PMS and update lead data so the UI
 * reflects the latest stage / objetivo / orcamento / confidence.
 *
 * Inbound mirroring uses /api/webhooks/whatsapp/inbound (already exists);
 * the n8n workflow needs an extra branch that POSTs every inbound to it.
 */
export async function POST(request: NextRequest) {
  try {
    const expected = process.env.WHATSAPP_WEBHOOK_SECRET;
    if (!expected) return apiError("Webhook not configured", 503);
    const provided = request.headers.get("x-webhook-secret") || "";
    if (!safeEqual(provided, expected)) return apiError("Forbidden", 403);

    const body = await request.json();
    const validation = outboundMirrorSchema.safeParse(body);
    if (!validation.success) return apiError("Validation failed", 400, validation.error.flatten());
    const payload = validation.data;
    const linePhone = payload.line_phone.startsWith("+") ? payload.line_phone : `+${payload.line_phone}`;
    const contactPhone = payload.contact_phone.startsWith("+") ? payload.contact_phone : `+${payload.contact_phone}`;

    const supabase = createAdminClient();
    const { data: lineRows } = await supabase
      .from("whatsapp_lines")
      .select("*")
      .eq("phone", linePhone)
      .limit(2);
    const lines = (lineRows as LineRow[]) || [];
    if (lines.length === 0) return apiError("Line not registered", 404);
    if (lines.length > 1) return apiError("Ambiguous line — phone in multiple tenants", 409);
    const line = lines[0];
    if (line.purpose !== "sales") return apiError("This endpoint serves sales lines only", 400);

    const conv = await findOrCreateConversation({
      companyId: line.company_id,
      lineId: line.id,
      contactPhone,
      contactName: payload.contact_name ?? null,
    });

    const message = await appendMessage({
      conversationId: conv.id,
      direction: "outbound",
      sender: "ai",
      text: payload.text,
      messageType: "text",
      externalId: payload.external_id ?? null,
      status: "sent",
      metadata: { auto_reply: true, source: "sales_workflow" } as never,
    });

    // Update lead data if any state was provided
    if (
      payload.lead_stage ||
      payload.objetivo ||
      payload.orcamento ||
      payload.confidence_score !== undefined ||
      payload.reasoning ||
      payload.origem
    ) {
      await upsertLeadData({
        conversationId: conv.id,
        origem: payload.origem ?? undefined,
        leadStage: payload.lead_stage ?? undefined,
        objetivo: payload.objetivo ?? undefined,
        orcamento: payload.orcamento ?? undefined,
        confidenceScore: payload.confidence_score ?? undefined,
        reasoning: payload.reasoning ?? undefined,
        marceloHandoffAt:
          payload.lead_stage === "handoff" ? new Date().toISOString() : undefined,
      });
    }

    return apiSuccess({ conversation_id: conv.id, message_id: message.id });
  } catch (error) {
    return apiServerError(error);
  }
}
