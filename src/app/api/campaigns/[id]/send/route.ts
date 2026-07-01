import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import { logActivity } from "@/lib/audit/log";
import { createAdminClient } from "@/lib/supabase/admin";
import { apiSuccess, apiError, apiUnauthorized, apiForbidden, apiNotFound, apiServerError } from "@/lib/api/response";
import { getCampaign, listRecipients, setCampaignStatus, recomputeTotal } from "@/lib/db/queries/campaign";
import { sendCampaignSchema } from "@/lib/validations/campaign";

type Params = { params: Promise<{ id: string }> };

function appUrl(): string | undefined {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return undefined;
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const user = await requireRole(["admin", "manager"]);
    const { id } = await params;
    const campaign = await getCampaign(id);
    if (!campaign) return apiNotFound("Campanha");
    if (campaign.company_id !== user.company_id) return apiForbidden();
    if (campaign.status === "sending") return apiError("Campanha já está em envio", 409);

    const parsed = sendCampaignSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return apiError("Dados inválidos", 400, parsed.error.flatten());

    // Agendamento: guarda e não dispara agora (um cron n8n chama /due depois).
    if (parsed.data.scheduled_at) {
      const when = new Date(parsed.data.scheduled_at);
      if (!isNaN(when.getTime()) && when.getTime() > Date.now()) {
        await setCampaignStatus(id, "scheduled", { scheduled_at: when.toISOString() });
        await logActivity({ user, action: "campaign.schedule", entityType: "campaign", entityId: id, details: { label: campaign.name, scheduled_at: when.toISOString() } });
        return apiSuccess({ id, status: "scheduled", scheduled_at: when.toISOString() });
      }
    }

    const total = await recomputeTotal(id);
    if (total === 0) return apiError("Adicione destinatários antes de disparar", 400);
    if (!campaign.line_id) return apiError("Defina o número de disparo (linha WhatsApp) da campanha", 400);

    // Linha de disparo (provider info p/ o n8n).
    const { data: line } = await (createAdminClient().from("whatsapp_lines") as any) // eslint-disable-line @typescript-eslint/no-explicit-any
      .select("id, company_id, phone, provider, provider_instance, provider_token")
      .eq("id", campaign.line_id)
      .maybeSingle();
    if (!line || line.company_id !== user.company_id) return apiError("Linha de disparo inválida", 400);

    const webhookUrl = process.env.CAMPAIGN_DISPATCH_WEBHOOK_URL;
    const secret = process.env.WHATSAPP_WEBHOOK_SECRET;
    if (!webhookUrl || !secret) {
      return apiError(
        "Disparo não configurado: defina CAMPAIGN_DISPATCH_WEBHOOK_URL (webhook do n8n) e WHATSAPP_WEBHOOK_SECRET.",
        501
      );
    }

    const recipients = (await listRecipients(id))
      .filter((r) => r.status === "pending")
      .map((r) => ({ id: r.id, phone_e164: r.phone_e164, phone_canonical: r.phone_canonical, name: r.name }));
    if (recipients.length === 0) return apiError("Nenhum destinatário pendente", 400);

    const base = appUrl();
    const payload = {
      campaign_id: id,
      callback_url: base ? `${base}/api/webhooks/campaigns/status` : undefined,
      message_template: campaign.message_template,
      media_url: campaign.media_url,
      media_mime_type: campaign.media_mime_type,
      throttle_seconds: campaign.throttle_seconds,
      line: {
        phone: line.phone,
        provider: line.provider,
        provider_instance: line.provider_instance,
        provider_token: line.provider_token,
      },
      recipients,
    };

    // Dispara o n8n. Só marca "sending" se o webhook aceitou.
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Webhook-Secret": secret },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return apiError(`n8n recusou o disparo (HTTP ${res.status}). ${body.slice(0, 200)}`, 502);
    }

    await setCampaignStatus(id, "sending", { started_at: new Date().toISOString(), scheduled_at: null });
    await logActivity({ user, action: "campaign.send", entityType: "campaign", entityId: id, details: { label: campaign.name, recipients: recipients.length } });
    return apiSuccess({ id, status: "sending", dispatched: recipients.length });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    if (error instanceof Error && error.message === "Forbidden") return apiForbidden();
    return apiServerError(error);
  }
}
