import { NextRequest } from "next/server";
import { requireAuth, requireRole } from "@/lib/auth";
import { logActivity } from "@/lib/audit/log";
import { apiSuccess, apiError, apiUnauthorized, apiForbidden, apiNotFound, apiServerError } from "@/lib/api/response";
import { getDeal, updateDeal, deleteDeal, getStage } from "@/lib/db/queries/funnel";
import { dealUpdateSchema } from "@/lib/validations/funnel";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const user = await requireAuth();
    const { id } = await params;
    const deal = await getDeal(id);
    if (!deal) return apiNotFound("Negócio");
    if (deal.company_id !== user.company_id) return apiForbidden();
    return apiSuccess(deal);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    return apiServerError(error);
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const user = await requireAuth();
    const { id } = await params;
    const deal = await getDeal(id);
    if (!deal) return apiNotFound("Negócio");
    if (deal.company_id !== user.company_id) return apiForbidden();
    const parsed = dealUpdateSchema.safeParse(await req.json());
    if (!parsed.success) return apiError("Dados inválidos", 400, parsed.error.flatten());

    // Move: valida a etapa alvo dentro do mesmo funil.
    if (parsed.data.stage_id && parsed.data.stage_id !== deal.stage_id) {
      const stage = await getStage(parsed.data.stage_id);
      if (!stage || stage.pipeline_id !== deal.pipeline_id) return apiError("Etapa inválida para este funil", 400);
    }
    const updated = await updateDeal(id, user.company_id, parsed.data);
    await logActivity({ user, action: "funnel_deal.update", entityType: "funnel_deal", entityId: id, details: { label: updated.title, stage_id: updated.stage_id } });
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
    const deal = await getDeal(id);
    if (!deal) return apiNotFound("Negócio");
    if (deal.company_id !== user.company_id) return apiForbidden();
    await deleteDeal(id, user.company_id);
    await logActivity({ user, action: "funnel_deal.delete", entityType: "funnel_deal", entityId: id, details: { label: deal.title } });
    return apiSuccess({ id });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    if (error instanceof Error && error.message === "Forbidden") return apiForbidden();
    return apiServerError(error);
  }
}
