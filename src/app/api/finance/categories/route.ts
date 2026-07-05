import { NextRequest } from "next/server";
import { requireAuth, requireRole } from "@/lib/auth";
import { logActivity } from "@/lib/audit/log";
import { apiSuccess, apiError, apiUnauthorized, apiForbidden, apiServerError } from "@/lib/api/response";
import { createFinCategory, listFinCategories } from "@/lib/db/queries/fin";
import { finCategorySchema } from "@/lib/validations/finance";

export async function GET(_req: NextRequest) {
  try {
    const user = await requireAuth();
    const data = await listFinCategories(user.company_id);
    return apiSuccess(data);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    return apiServerError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireRole(["admin", "manager"]);
    const parsed = finCategorySchema.safeParse(await req.json());
    if (!parsed.success) return apiError("Dados inválidos", 400, parsed.error.flatten());
    const category = await createFinCategory(user.company_id, parsed.data);
    await logActivity({
      user,
      action: "fin_category.create",
      entityType: "fin_category",
      entityId: category.id,
      details: { name: category.name, type: category.type, parent_id: category.parent_id },
    });
    return apiSuccess(category);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    if (error instanceof Error && error.message === "Forbidden") return apiForbidden();
    if (error instanceof Error && /duplicate|unique/i.test(error.message)) {
      return apiError("Já existe uma categoria com esse nome nesse nível", 409);
    }
    return apiServerError(error);
  }
}
