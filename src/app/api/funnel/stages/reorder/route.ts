import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import { logActivity } from "@/lib/audit/log";
import { apiSuccess, apiError, apiUnauthorized, apiForbidden, apiServerError } from "@/lib/api/response";
import { getPipeline, reorderStages, listStages } from "@/lib/db/queries/funnel";
import { stageReorderSchema } from "@/lib/validations/funnel";

export async function POST(req: NextRequest) {
  try {
    const user = await requireRole(["admin", "manager"]);
    const parsed = stageReorderSchema.safeParse(await req.json());
    if (!parsed.success) return apiError("Dados inválidos", 400, parsed.error.flatten());
    const pipe = await getPipeline(parsed.data.pipeline_id);
    if (!pipe || pipe.company_id !== user.company_id) return apiForbidden();
    await reorderStages(parsed.data.pipeline_id, parsed.data.ordered_ids);
    await logActivity({ user, action: "funnel_stage.reorder", entityType: "funnel_pipeline", entityId: parsed.data.pipeline_id });
    return apiSuccess(await listStages(parsed.data.pipeline_id));
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    if (error instanceof Error && error.message === "Forbidden") return apiForbidden();
    return apiServerError(error);
  }
}
