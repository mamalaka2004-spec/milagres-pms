import { NextRequest } from "next/server";
import { requireFullAccess, requireRole } from "@/lib/auth";
import { logActivity } from "@/lib/audit/log";
import { apiSuccess, apiError, apiUnauthorized, apiForbidden, apiServerError } from "@/lib/api/response";
import { listStages, createStage, getPipeline } from "@/lib/db/queries/funnel";
import { stageCreateSchema } from "@/lib/validations/funnel";

export async function GET(req: NextRequest) {
  try {
    const user = await requireFullAccess();
    const pipelineId = req.nextUrl.searchParams.get("pipeline_id");
    if (!pipelineId) return apiError("pipeline_id é obrigatório", 400);
    const pipe = await getPipeline(pipelineId);
    if (!pipe || pipe.company_id !== user.company_id) return apiForbidden();
    const data = await listStages(pipelineId);
    return apiSuccess(data);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    if (error instanceof Error && error.message === "Forbidden") return apiForbidden();
    return apiSuccess([]);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireRole(["admin", "manager"]);
    const parsed = stageCreateSchema.safeParse(await req.json());
    if (!parsed.success) return apiError("Dados inválidos", 400, parsed.error.flatten());
    const pipe = await getPipeline(parsed.data.pipeline_id);
    if (!pipe || pipe.company_id !== user.company_id) return apiForbidden();
    const stage = await createStage(parsed.data);
    await logActivity({ user, action: "funnel_stage.create", entityType: "funnel_stage", entityId: stage.id, details: { label: stage.name } });
    return apiSuccess(stage);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    if (error instanceof Error && error.message === "Forbidden") return apiForbidden();
    return apiServerError(error);
  }
}
