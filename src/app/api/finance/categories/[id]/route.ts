import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import { logActivity } from "@/lib/audit/log";
import { apiSuccess, apiError, apiUnauthorized, apiForbidden, apiNotFound, apiServerError } from "@/lib/api/response";
import { deleteFinCategory, updateFinCategory } from "@/lib/db/queries/fin";
import { finCategoryUpdateSchema } from "@/lib/validations/finance";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const user = await requireRole(["admin", "manager"]);
    const { id } = await params;
    const parsed = finCategoryUpdateSchema.safeParse(await req.json());
    if (!parsed.success) return apiError("Dados inválidos", 400, parsed.error.flatten());
    if (parsed.data.parent_id === id) {
      return apiError("Uma categoria não pode ser filha de si mesma", 400);
    }
    const updated = await updateFinCategory(user.company_id, id, parsed.data);
    if (!updated) return apiNotFound("Categoria");
    await logActivity({
      user,
      action: "fin_category.update",
      entityType: "fin_category",
      entityId: id,
      details: { name: updated.name },
    });
    return apiSuccess(updated);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    if (error instanceof Error && error.message === "Forbidden") return apiForbidden();
    if (error instanceof Error && /duplicate|unique/i.test(error.message)) {
      return apiError("Já existe uma categoria com esse nome nesse nível", 409);
    }
    return apiServerError(error);
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const user = await requireRole(["admin", "manager"]);
    const { id } = await params;
    const removed = await deleteFinCategory(user.company_id, id);
    if (!removed) return apiNotFound("Categoria");
    await logActivity({ user, action: "fin_category.delete", entityType: "fin_category", entityId: id });
    return apiSuccess({ id });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    if (error instanceof Error && error.message === "Forbidden") return apiForbidden();
    return apiServerError(error);
  }
}
