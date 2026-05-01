import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { requireLineAccess } from "@/lib/whatsapp/auth";
import {
  getConversationById,
  updateConversation,
} from "@/lib/db/queries/whatsapp";
import { aiControlSchema } from "@/lib/validations/sales";
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

/**
 * Pause/resume the AI on this sales conversation.
 *
 * Two-pronged: (1) flip `conversation.ai_active` so the PMS UI reflects the
 * state immediately, (2) call the n8n control webhook so the actual sales
 * workflow (`Milagres Completo`) sees the pause via Redis on the next inbound.
 *
 * Configure the webhook in n8n that sets/deletes `paused:{phone}@s.whatsapp.net`
 * in Redis, and point WHATSAPP_AI_CONTROL_WEBHOOK_URL at it.
 */
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const user = await requireAuth();
    const { id } = await params;

    const body = await req.json();
    const validation = aiControlSchema.safeParse(body);
    if (!validation.success) return apiError("Validation failed", 400, validation.error.flatten());
    const { action } = validation.data;

    const conv = await getConversationById(id);
    if (!conv) return apiNotFound("Conversation");
    if (conv.company_id !== user.company_id) return apiForbidden();
    await requireLineAccess(user, conv.line_id);

    const aiActive = action === "resume";
    const updated = await updateConversation(id, { ai_active: aiActive });

    // Notify n8n / Redis. Best-effort: if not configured, the PMS state still
    // changes — operator should be aware their UI may diverge from the AI.
    const ctrlUrl = process.env.WHATSAPP_AI_CONTROL_WEBHOOK_URL;
    const secret = process.env.WHATSAPP_WEBHOOK_SECRET;
    let n8nResult: { ok: boolean; status?: number; error?: string } = { ok: false, error: "not configured" };
    if (ctrlUrl && secret) {
      try {
        const res = await fetch(ctrlUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Webhook-Secret": secret,
          },
          body: JSON.stringify({
            action,
            contact_phone: conv.contact_phone,
            line_phone: undefined, // can be looked up server-side if needed
            conversation_id: id,
          }),
        });
        n8nResult = { ok: res.ok, status: res.status };
      } catch (e) {
        n8nResult = { ok: false, error: e instanceof Error ? e.message : "fetch failed" };
      }
    }

    return apiSuccess({ conversation: updated, n8n: n8nResult });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    if (error instanceof Error && error.message === "Forbidden") return apiForbidden();
    return apiServerError(error);
  }
}
