import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import { logActivity } from "@/lib/audit/log";
import { apiSuccess, apiError, apiUnauthorized, apiForbidden, apiNotFound, apiServerError } from "@/lib/api/response";
import { getPipeline, updatePipeline, archivePipeline } from "@/lib/db/queries/funnel";
import { pipelineUpdateSchema } from "@/lib/validations/funnel";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const user = await requireRole(["admin", "manager"]);
    const { id } = await params;
    const pipe = await getPipeline(id);
    if (!pipe) return apiNotFound("Funil");
    if (pipe.company_id !== user.company_id) return apiForbidden();
    const parsed = pipelineUpdateSchema.safeParse(await req.json());
    if (!parsed.success) return apiError("Dados inválidos", 400, parsed.error.flatten());
    const updated = await updatePipeline(id, user.company_id, parsed.data);
    await logActivity({ user, action: "funnel_pipeline.update", entityType: "funnel_pipeline", entityId: id, details: { label: updated.name } });
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
    const pipe = await getPipeline(id);
    if (!pipe) return apiNotFound("Funil");
    if (pipe.company_id !== user.company_id) return apiForbidden();
    await archivePipeline(id, user.company_id);
    await logActivity({ user, action: "funnel_pipeline.delete", entityType: "funnel_pipeline", entityId: id, details: { label: pipe.name } });
    return apiSuccess({ id });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    if (error instanceof Error && error.message === "Forbidden") return apiForbidden();
    return apiError(error instanceof Error ? error.message : "Erro ao remover funil", 400);
  }
}
