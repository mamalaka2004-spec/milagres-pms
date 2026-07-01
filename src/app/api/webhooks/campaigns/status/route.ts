import { NextRequest } from "next/server";
import { apiSuccess, apiError } from "@/lib/api/response";
import { updateRecipientStatus } from "@/lib/db/queries/campaign";
import { campaignStatusCallbackSchema } from "@/lib/validations/campaign";

/**
 * Callback do n8n durante o disparo de uma campanha. Autenticado por segredo
 * partilhado (header `x-webhook-secret` = WHATSAPP_WEBHOOK_SECRET), igual aos
 * demais webhooks. Chamado UMA vez por destinatário conforme o envio resolve.
 */
export async function POST(request: NextRequest) {
  const expected = process.env.WHATSAPP_WEBHOOK_SECRET;
  const provided = request.headers.get("x-webhook-secret") || "";
  if (!expected || provided !== expected) return apiError("Unauthorized", 401);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("JSON inválido", 400);
  }
  const parsed = campaignStatusCallbackSchema.safeParse(body);
  if (!parsed.success) return apiError("Payload inválido", 400, parsed.error.flatten());

  try {
    await updateRecipientStatus(parsed.data.campaign_id, parsed.data.recipient_id, parsed.data.status, {
      external_id: parsed.data.external_id ?? undefined,
      error: parsed.data.error ?? undefined,
    });
    return apiSuccess({ ok: true });
  } catch (error) {
    console.error("[campaigns/status] callback failed:", error);
    return apiError("Erro ao registrar status", 500);
  }
}
