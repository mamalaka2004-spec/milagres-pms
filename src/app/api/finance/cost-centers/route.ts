import { NextRequest } from "next/server";
import { requireAuth, requireRole } from "@/lib/auth";
import { logActivity } from "@/lib/audit/log";
import { apiSuccess, apiError, apiUnauthorized, apiForbidden, apiServerError } from "@/lib/api/response";
import { createCostCenter, listCostCenters } from "@/lib/db/queries/fin";
import { costCenterSchema } from "@/lib/validations/finance";

export async function GET(_req: NextRequest) {
  try {
    const user = await requireAuth();
    const data = await listCostCenters(user.company_id);
    return apiSuccess(data);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    return apiServerError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireRole(["admin", "manager"]);
    const parsed = costCenterSchema.safeParse(await req.json());
    if (!parsed.success) return apiError("Dados inválidos", 400, parsed.error.flatten());
    const center = await createCostCenter(user.company_id, parsed.data);
    await logActivity({
      user,
      action: "fin_cost_center.create",
      entityType: "cost_center",
      entityId: center.id,
      details: { name: center.name },
    });
    return apiSuccess(center);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    if (error instanceof Error && error.message === "Forbidden") return apiForbidden();
    if (error instanceof Error && /duplicate|unique/i.test(error.message)) {
      return apiError("Já existe um centro de custo com esse nome", 409);
    }
    return apiServerError(error);
  }
}
