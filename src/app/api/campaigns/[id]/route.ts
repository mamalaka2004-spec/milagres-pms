import { NextRequest } from "next/server";
import { requireFullAccess, requireRole } from "@/lib/auth";
import { logActivity } from "@/lib/audit/log";
import { apiSuccess, apiError, apiUnauthorized, apiForbidden, apiNotFound, apiServerError } from "@/lib/api/response";
import { getCampaign, updateCampaign, deleteCampaign, listRecipients } from "@/lib/db/queries/campaign";
import { campaignUpdateSchema } from "@/lib/validations/campaign";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const user = await requireFullAccess();
    const { id } = await params;
    const campaign = await getCampaign(id);
    if (!campaign) return apiNotFound("Campanha");
    if (campaign.company_id !== user.company_id) return apiForbidden();
    const recipients = await listRecipients(id);
    return apiSuccess({ ...campaign, recipients });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    if (error instanceof Error && error.message === "Forbidden") return apiForbidden();
    return apiServerError(error);
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const user = await requireRole(["admin", "manager"]);
    const { id } = await params;
    const campaign = await getCampaign(id);
    if (!campaign) return apiNotFound("Campanha");
    if (campaign.company_id !== user.company_id) return apiForbidden();
    if (campaign.status === "sending") return apiError("Campanha em envio não pode ser editada", 409);
    const parsed = campaignUpdateSchema.safeParse(await req.json());
    if (!parsed.success) return apiError("Dados inválidos", 400, parsed.error.flatten());
    const updated = await updateCampaign(id, user.company_id, parsed.data);
    await logActivity({ user, action: "campaign.update", entityType: "campaign", entityId: id, details: { label: updated.name } });
    return apiSuccess(updated);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    if (error instanceof Error && error.message === "Forbidden") return apiForbidden();
    return apiServerError(error);
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const user = await requireRole(["admin", "manager"]);
    const { id } = await params;
    const campaign = await getCampaign(id);
    if (!campaign) return apiNotFound("Campanha");
    if (campaign.company_id !== user.company_id) return apiForbidden();
    if (campaign.status === "sending") return apiError("Campanha em envio não pode ser removida", 409);
    await deleteCampaign(id, user.company_id);
    await logActivity({ user, action: "campaign.delete", entityType: "campaign", entityId: id, details: { label: campaign.name } });
    return apiSuccess({ id });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    if (error instanceof Error && error.message === "Forbidden") return apiForbidden();
    return apiServerError(error);
  }
}
