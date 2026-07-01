import { NextRequest } from "next/server";
import { requireAuth, requireRole } from "@/lib/auth";
import { logActivity } from "@/lib/audit/log";
import { apiSuccess, apiError, apiUnauthorized, apiForbidden, apiServerError } from "@/lib/api/response";
import { listPipelines, createPipeline } from "@/lib/db/queries/funnel";
import { pipelineCreateSchema } from "@/lib/validations/funnel";
import type { FunnelType } from "@/types/funnel";

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth();
    const typeParam = req.nextUrl.searchParams.get("type") as FunnelType | null;
    const type = typeParam === "locacao" || typeParam === "vendas" ? typeParam : undefined;
    const data = await listPipelines(user.company_id, type);
    return apiSuccess(data);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    // Tabela ainda não existe (migration 023 não rodada) — degrada.
    return apiSuccess([]);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireRole(["admin", "manager"]);
    const parsed = pipelineCreateSchema.safeParse(await req.json());
    if (!parsed.success) return apiError("Dados inválidos", 400, parsed.error.flatten());
    const pipeline = await createPipeline(user.company_id, parsed.data);
    await logActivity({ user, action: "funnel_pipeline.create", entityType: "funnel_pipeline", entityId: pipeline.id, details: { label: pipeline.name, type: pipeline.type } });
    return apiSuccess(pipeline);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    if (error instanceof Error && error.message === "Forbidden") return apiForbidden();
    return apiServerError(error);
  }
}
