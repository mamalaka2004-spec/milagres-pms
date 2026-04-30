import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  appendMessage,
  findOrCreateConversation,
} from "@/lib/db/queries/whatsapp";
import { isOutsideBusinessHours } from "@/lib/whatsapp/auth";
import { inboundWebhookSchema } from "@/lib/validations/whatsapp";
import {
  apiSuccess,
  apiError,
  apiServerError,
} from "@/lib/api/response";
import type { Database } from "@/types/database";
import { timingSafeEqual } from "node:crypto";

type LineRow = Database["public"]["Tables"]["whatsapp_lines"]["Row"];

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

    const conv = await findOrCreateConversation({
      companyId: line.company_id,
      lineId: line.id,
      contactPhone,
      contactName: payload.contact_name ?? null,
    });

    const message = await appendMessage({
      conversationId: conv.id,
      direction: "inbound",
      sender: "guest",
      text: payload.text ?? null,
      messageType: payload.message_type,
      mediaUrl: payload.media_url ?? null,
      mediaMimeType: payload.media_mime_type ?? null,
      fileName: payload.file_name ?? null,
      externalId: payload.external_id ?? null,
      bumpUnread: true,
    });

    // Decide whether the AI should auto-reply (n8n calls /api/whatsapp/ai-reply if true).
    const aiShouldRespond =
      line.ai_enabled &&
      conv.ai_active &&
      conv.status === "open" &&
      isOutsideBusinessHours(line.business_hours);

    return apiSuccess({
      conversation_id: conv.id,
      message_id: message.id,
      ai_should_respond: aiShouldRespond,
    });
  } catch (error) {
    return apiServerError(error);
  }
}
