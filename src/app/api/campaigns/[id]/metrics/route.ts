import { NextRequest } from "next/server";
import { requireFullAccess } from "@/lib/auth";
import { apiSuccess, apiUnauthorized, apiForbidden, apiNotFound, apiServerError } from "@/lib/api/response";
import { getCampaign, getCampaignMetrics } from "@/lib/db/queries/campaign";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const user = await requireFullAccess();
    const { id } = await params;
    const campaign = await getCampaign(id);
    if (!campaign) return apiNotFound("Campanha");
    if (campaign.company_id !== user.company_id) return apiForbidden();
    const metrics = await getCampaignMetrics(id);
    return apiSuccess({ campaign, ...metrics });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    if (error instanceof Error && error.message === "Forbidden") return apiForbidden();
    return apiServerError(error);
  }
}
