import { NextRequest } from "next/server";
import { requireFullAccess, requireRole } from "@/lib/auth";
import { logActivity } from "@/lib/audit/log";
import { apiSuccess, apiError, apiUnauthorized, apiForbidden, apiNotFound, apiServerError } from "@/lib/api/response";
import { getCampaign, listSteps, replaceSteps } from "@/lib/db/queries/campaign";
import { campaignStepsReplaceSchema } from "@/lib/validations/campaign";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const user = await requireFullAccess();
    const { id } = await params;
    const campaign = await getCampaign(id);
    if (!campaign) return apiNotFound("Campanha");
    if (campaign.company_id !== user.company_id) return apiForbidden();
    return apiSuccess(await listSteps(id));
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    if (error instanceof Error && error.message === "Forbidden") return apiForbidden();
    return apiServerError(error);
  }
}

/** Replace-all dos passos (ordem = índice do array). */
export async function PUT(req: NextRequest, { params }: Params) {
  try {
    const user = await requireRole(["admin", "manager"]);
    const { id } = await params;
    const campaign = await getCampaign(id);
    if (!campaign) return apiNotFound("Campanha");
    if (campaign.company_id !== user.company_id) return apiForbidden();
    if (campaign.status === "sending") {
      return apiError("Pause a campanha antes de editar os passos", 409);
    }
    const parsed = campaignStepsReplaceSchema.safeParse(await req.json());
    if (!parsed.success) return apiError("Dados inválidos", 400, parsed.error.flatten());
    const steps = await replaceSteps(id, parsed.data.steps);
    await logActivity({ user, action: "campaign.steps", entityType: "campaign", entityId: id, details: { label: campaign.name, steps: steps.length } });
    return apiSuccess(steps);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    if (error instanceof Error && error.message === "Forbidden") return apiForbidden();
    return apiServerError(error);
  }
}
