import { NextRequest } from "next/server";
import { requireFullAccess } from "@/lib/auth";
import { logActivity } from "@/lib/audit/log";
import { apiSuccess, apiError, apiUnauthorized, apiForbidden, apiServerError } from "@/lib/api/response";
import { listDealsByPipeline, createDeal, getPipeline, getStage } from "@/lib/db/queries/funnel";
import { dealCreateSchema } from "@/lib/validations/funnel";

export async function GET(req: NextRequest) {
  try {
    const user = await requireFullAccess();
    const pipelineId = req.nextUrl.searchParams.get("pipeline_id");
    if (!pipelineId) return apiError("pipeline_id é obrigatório", 400);
    const pipe = await getPipeline(pipelineId);
    if (!pipe || pipe.company_id !== user.company_id) return apiForbidden();
    return apiSuccess(await listDealsByPipeline(pipelineId));
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    if (error instanceof Error && error.message === "Forbidden") return apiForbidden();
    return apiSuccess([]);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireFullAccess();
    const parsed = dealCreateSchema.safeParse(await req.json());
    if (!parsed.success) return apiError("Dados inválidos", 400, parsed.error.flatten());
    const pipe = await getPipeline(parsed.data.pipeline_id);
    if (!pipe || pipe.company_id !== user.company_id) return apiForbidden();
    const stage = await getStage(parsed.data.stage_id);
    if (!stage || stage.pipeline_id !== pipe.id) return apiError("Etapa inválida para este funil", 400);
    const deal = await createDeal(user.company_id, user.id, parsed.data);
    await logActivity({ user, action: "funnel_deal.create", entityType: "funnel_deal", entityId: deal.id, details: { label: deal.title } });
    return apiSuccess(deal);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    if (error instanceof Error && error.message === "Forbidden") return apiForbidden();
    return apiServerError(error);
  }
}
