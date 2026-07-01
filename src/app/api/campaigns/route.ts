import { NextRequest } from "next/server";
import { requireAuth, requireRole } from "@/lib/auth";
import { logActivity } from "@/lib/audit/log";
import { apiSuccess, apiError, apiUnauthorized, apiForbidden, apiServerError } from "@/lib/api/response";
import { listCampaigns, createCampaign } from "@/lib/db/queries/campaign";
import { campaignCreateSchema } from "@/lib/validations/campaign";

export async function GET() {
  try {
    const user = await requireAuth();
    return apiSuccess(await listCampaigns(user.company_id));
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    return apiSuccess([]);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireRole(["admin", "manager"]);
    const parsed = campaignCreateSchema.safeParse(await req.json());
    if (!parsed.success) return apiError("Dados inválidos", 400, parsed.error.flatten());
    const campaign = await createCampaign(user.company_id, user.id, parsed.data);
    await logActivity({ user, action: "campaign.create", entityType: "campaign", entityId: campaign.id, details: { label: campaign.name } });
    return apiSuccess(campaign);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    if (error instanceof Error && error.message === "Forbidden") return apiForbidden();
    return apiServerError(error);
  }
}
