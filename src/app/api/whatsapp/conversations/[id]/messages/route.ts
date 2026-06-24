import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { requireLineAccess } from "@/lib/whatsapp/auth";
import {
  appendMessage,
  getConversationById,
  listMessages,
} from "@/lib/db/queries/whatsapp";
import { messageSendSchema } from "@/lib/validations/whatsapp";
import { sendText, sendMedia } from "@/lib/whatsapp/evolution";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  apiSuccess,
  apiError,
  apiUnauthorized,
  apiForbidden,
  apiNotFound,
  apiServerError,
} from "@/lib/api/response";

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const user = await requireAuth();
    const { id } = await params;
    const conv = await getConversationById(id);
    if (!conv) return apiNotFound("Conversation");
    if (conv.company_id !== user.company_id) return apiForbidden();
    await requireLineAccess(user, conv.line_id);

    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "60", 10) || 60, 200);
    const before = searchParams.get("before") || undefined;
    const messages = await listMessages(id, limit, before);
    return apiSuccess(messages);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    if (error instanceof Error && error.message === "Forbidden") return apiForbidden();
    return apiServerError(error);
  }
}

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const user = await requireAuth();
    const { id } = await params;
    const conv = await getConversationById(id);
    if (!conv) return apiNotFound("Conversation");
    if (conv.company_id !== user.company_id) return apiForbidden();
    const line = await requireLineAccess(user, conv.line_id);

    const body = await request.json();
    const validation = messageSendSchema.safeParse(body);
    if (!validation.success) return apiError("Validation failed", 400, validation.error.flatten());
    const data = validation.data;

    const messageType = data.media_mime_type
      ? data.media_mime_type.startsWith("image/")
        ? "image"
        : data.media_mime_type.startsWith("audio/")
        ? "audio"
        : data.media_mime_type.startsWith("video/")
        ? "video"
        : "document"
      : "text";

    // Persist immediately as `pending`. Outbound dispatch (to n8n / provider)
    // happens after — failure to send updates status to `failed` but the row stays.
    const message = await appendMessage({
      conversationId: id,
      direction: "outbound",
      sender: "agent",
      senderUserId: user.id,
      text: data.text ?? null,
      messageType: messageType as "text" | "image" | "audio" | "video" | "document",
      mediaUrl: data.media_url ?? null,
      mediaMimeType: data.media_mime_type ?? null,
      fileName: data.file_name ?? null,
      replyToId: data.reply_to_id ?? null,
      status: "pending",
    });

    // Outbound dispatch — send via Evolution directly and resolve the status, so a
    // message never sticks on "pending" forever. (Previously this fired an n8n webhook
    // fire-and-forget that never updated the status.)
    let finalStatus: "sent" | "failed" = "failed";
    let externalId: string | undefined;
    let sendError: string | undefined;

    if (line.provider === "evolution") {
      try {
        const res =
          messageType !== "text" && data.media_url
            ? await sendMedia(
                conv.contact_phone, data.media_url, data.media_mime_type || "application/octet-stream",
                data.text ?? undefined, data.file_name ?? undefined, line.provider_instance || undefined,
              )
            : await sendText(conv.contact_phone, data.text ?? "", line.provider_instance || undefined);
        externalId = res.external_id;
        finalStatus = "sent";
      } catch (e) {
        sendError = e instanceof Error ? e.message : String(e);
        console.error("[whatsapp] Evolution send failed:", sendError);
      }
    } else {
      // Non-Evolution provider — legacy outbound webhook (best-effort, optimistic).
      const webhookUrl = process.env.WHATSAPP_OUTBOUND_WEBHOOK_URL;
      const secret = process.env.WHATSAPP_WEBHOOK_SECRET;
      if (webhookUrl && secret) {
        finalStatus = "sent";
        fetch(webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Webhook-Secret": secret },
          body: JSON.stringify({
            conversation_id: id, message_id: message.id, line_phone: line.phone, provider: line.provider,
            provider_instance: line.provider_instance, contact_phone: conv.contact_phone,
            text: data.text || null, media_url: data.media_url || null,
            media_mime_type: data.media_mime_type || null, file_name: data.file_name || null,
          }),
        }).catch((err) => console.error("[whatsapp] outbound webhook failed:", err));
      }
    }

    // Resolve the message status so the UI reflects sent/failed (realtime UPDATE picks it up).
    const supabase = createAdminClient();
    await (supabase.from("whatsapp_messages") as any) // eslint-disable-line @typescript-eslint/no-explicit-any
      .update({ status: finalStatus, external_id: externalId ?? null })
      .eq("id", message.id);

    return apiSuccess({ ...message, status: finalStatus, external_id: externalId ?? message.external_id }, 201);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    if (error instanceof Error && error.message === "Forbidden") return apiForbidden();
    return apiServerError(error);
  }
}
