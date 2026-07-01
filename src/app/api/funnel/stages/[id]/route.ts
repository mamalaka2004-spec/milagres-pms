import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import { logActivity } from "@/lib/audit/log";
import { apiSuccess, apiError, apiUnauthorized, apiForbidden, apiNotFound, apiServerError } from "@/lib/api/response";
import { getStage, getPipeline, updateStage, deleteStage } from "@/lib/db/queries/funnel";
import { stageUpdateSchema } from "@/lib/validations/funnel";

type Params = { params: Promise<{ id: string }> };

async function ownStage(id: string, companyId: string) {
  const stage = await getStage(id);
  if (!stage) return { error: "notfound" as const };
  const pipe = await getPipeline(stage.pipeline_id);
  if (!pipe || pipe.company_id !== companyId) return { error: "forbidden" as const };
  return { stage };
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const user = await requireRole(["admin", "manager"]);
    const { id } = await params;
    const owned = await ownStage(id, user.company_id);
    if (owned.error === "notfound") return apiNotFound("Etapa");
    if (owned.error === "forbidden") return apiForbidden();
    const parsed = stageUpdateSchema.safeParse(await req.json());
    if (!parsed.success) return apiError("Dados inválidos", 400, parsed.error.flatten());
    const updated = await updateStage(id, parsed.data);
    await logActivity({ user, action: "funnel_stage.update", entityType: "funnel_stage", entityId: id, details: { label: updated.name } });
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
    const owned = await ownStage(id, user.company_id);
    if (owned.error === "notfound") return apiNotFound("Etapa");
    if (owned.error === "forbidden") return apiForbidden();
    await deleteStage(id);
    await logActivity({ user, action: "funnel_stage.delete", entityType: "funnel_stage", entityId: id, details: { label: owned.stage?.name } });
    return apiSuccess({ id });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    if (error instanceof Error && error.message === "Forbidden") return apiForbidden();
    return apiError(error instanceof Error ? error.message : "Erro ao remover etapa", 400);
  }
}
