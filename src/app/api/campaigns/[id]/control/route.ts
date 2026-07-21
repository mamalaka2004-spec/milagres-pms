import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import { logActivity } from "@/lib/audit/log";
import { createAdminClient } from "@/lib/supabase/admin";
import { apiSuccess, apiError, apiUnauthorized, apiForbidden, apiNotFound, apiServerError } from "@/lib/api/response";
import { getCampaign, setCampaignStatus } from "@/lib/db/queries/campaign";
import { campaignControlSchema } from "@/lib/validations/campaign";

type Params = { params: Promise<{ id: string }> };

/** Pausar / retomar / cancelar — o worker campaign-tick só processa scheduled|sending. */
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const user = await requireRole(["admin", "manager"]);
    const { id } = await params;
    const campaign = await getCampaign(id);
    if (!campaign) return apiNotFound("Campanha");
    if (campaign.company_id !== user.company_id) return apiForbidden();

    const parsed = campaignControlSchema.safeParse(await req.json());
    if (!parsed.success) return apiError("Dados inválidos", 400, parsed.error.flatten());
    const { action } = parsed.data;

    if (action === "pause") {
      if (campaign.status !== "sending" && campaign.status !== "scheduled") {
        return apiError("Só é possível pausar campanha agendada ou em envio", 409);
      }
      await setCampaignStatus(id, "paused");
    } else if (action === "resume") {
      if (campaign.status !== "paused") return apiError("A campanha não está pausada", 409);
      await setCampaignStatus(id, "scheduled");
    } else {
      if (campaign.status === "sent" || campaign.status === "cancelled") {
        return apiError("Campanha já finalizada", 409);
      }
      await (createAdminClient().from("campaign_recipients") as any) // eslint-disable-line @typescript-eslint/no-explicit-any
        .update({ status: "skipped", error: "campanha cancelada" })
        .eq("campaign_id", id)
        .in("status", ["pending", "sending"]);
      await setCampaignStatus(id, "cancelled", { finished_at: new Date().toISOString() });
    }

    await logActivity({
      user,
      action: `campaign.${action}`,
      entityType: "campaign",
      entityId: id,
      details: { label: campaign.name },
    });
    const updated = await getCampaign(id);
    return apiSuccess(updated);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    if (error instanceof Error && error.message === "Forbidden") return apiForbidden();
    return apiServerError(error);
  }
}
