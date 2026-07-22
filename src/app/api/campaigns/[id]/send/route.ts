import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import { logActivity } from "@/lib/audit/log";
import { createAdminClient } from "@/lib/supabase/admin";
import { apiSuccess, apiError, apiUnauthorized, apiForbidden, apiNotFound, apiServerError } from "@/lib/api/response";
import { getCampaign, ensureStepFromTemplate, enqueueCampaign } from "@/lib/db/queries/campaign";
import { sendCampaignSchema } from "@/lib/validations/campaign";

type Params = { params: Promise<{ id: string }> };

/**
 * Enfileira a campanha para o worker `campaign-tick` (edge function + pg_cron):
 * valida linha e passos, resolve audiência de listas, filtra opt-out/conversas
 * ativas e distribui `scheduled_for` com gap randômico dentro da janela.
 * O envio físico acontece no worker — nada de n8n aqui.
 */
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

    if (!campaign.line_id) return apiError("Defina o número de disparo (linha WhatsApp) da campanha", 400);
    const { data: line } = await (createAdminClient().from("whatsapp_lines") as any) // eslint-disable-line @typescript-eslint/no-explicit-any
      .select("id, company_id, is_active, provider_instance")
      .eq("id", campaign.line_id)
      .maybeSingle();
    if (!line || line.company_id !== user.company_id) return apiError("Linha de disparo inválida", 400);
    if (!line.is_active || !line.provider_instance) return apiError("Linha de disparo inativa ou sem instância conectada", 400);

    const steps = await ensureStepFromTemplate(campaign);
    if (steps.length === 0) return apiError("A campanha não tem nenhuma mensagem (passo)", 400);

    const scheduledAt =
      parsed.data.scheduled_at && new Date(parsed.data.scheduled_at).getTime() > Date.now()
        ? new Date(parsed.data.scheduled_at).toISOString()
        : null;

    let queued = 0;
    let skipped = 0;
    try {
      ({ queued, skipped } = await enqueueCampaign(campaign, {
        scheduledAt,
        listIds: parsed.data.list_ids ?? campaign.audience?.list_ids,
      }));
    } catch (e) {
      // Janela de envio inválida/sem slot → erro claro em vez de fila fantasma.
      if (e instanceof Error && /Janela de envio|Sem horário válido/.test(e.message)) {
        return apiError(e.message, 400);
      }
      throw e;
    }
    if (queued === 0) {
      return apiError(
        skipped > 0
          ? `Nenhum destinatário elegível (${skipped} pulados por opt-out/conversa ativa)`
          : "Adicione destinatários antes de disparar",
        400
      );
    }

    await logActivity({
      user,
      action: scheduledAt ? "campaign.schedule" : "campaign.send",
      entityType: "campaign",
      entityId: id,
      details: { label: campaign.name, queued, skipped, scheduled_at: scheduledAt },
    });
    return apiSuccess({ id, status: "scheduled", queued, skipped, scheduled_at: scheduledAt });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    if (error instanceof Error && error.message === "Forbidden") return apiForbidden();
    return apiServerError(error);
  }
}
