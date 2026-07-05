import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import { logActivity } from "@/lib/audit/log";
import { apiSuccess, apiError, apiUnauthorized, apiForbidden, apiNotFound, apiServerError } from "@/lib/api/response";
import { deleteCostCenter, updateCostCenter } from "@/lib/db/queries/fin";
import { costCenterUpdateSchema } from "@/lib/validations/finance";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const user = await requireRole(["admin", "manager"]);
    const { id } = await params;
    const parsed = costCenterUpdateSchema.safeParse(await req.json());
    if (!parsed.success) return apiError("Dados inválidos", 400, parsed.error.flatten());
    const updated = await updateCostCenter(user.company_id, id, parsed.data);
    if (!updated) return apiNotFound("Centro de custo");
    await logActivity({
      user,
      action: "fin_cost_center.update",
      entityType: "cost_center",
      entityId: id,
      details: { name: updated.name },
    });
    return apiSuccess(updated);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    if (error instanceof Error && error.message === "Forbidden") return apiForbidden();
    if (error instanceof Error && /duplicate|unique/i.test(error.message)) {
      return apiError("Já existe um centro de custo com esse nome", 409);
    }
    return apiServerError(error);
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const user = await requireRole(["admin", "manager"]);
    const { id } = await params;
    const removed = await deleteCostCenter(user.company_id, id);
    if (!removed) return apiNotFound("Centro de custo");
    await logActivity({ user, action: "fin_cost_center.delete", entityType: "cost_center", entityId: id });
    return apiSuccess({ id });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    if (error instanceof Error && error.message === "Forbidden") return apiForbidden();
    return apiServerError(error);
  }
}
