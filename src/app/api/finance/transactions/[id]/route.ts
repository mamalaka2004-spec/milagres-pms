import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import { logActivity } from "@/lib/audit/log";
import { apiSuccess, apiError, apiUnauthorized, apiForbidden, apiNotFound, apiServerError } from "@/lib/api/response";
import { deleteFinTransaction, updateFinTransaction } from "@/lib/db/queries/fin";
import { finTransactionUpdateSchema, toTransactionRow } from "@/lib/validations/finance";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const user = await requireRole(["admin", "manager"]);
    const { id } = await params;
    const parsed = finTransactionUpdateSchema.safeParse(await req.json());
    if (!parsed.success) return apiError("Dados inválidos", 400, parsed.error.flatten());
    const updated = await updateFinTransaction(user.company_id, id, toTransactionRow(parsed.data));
    if (!updated) return apiNotFound("Transação");
    await logActivity({
      user,
      action: "fin_transaction.update",
      entityType: "fin_transaction",
      entityId: id,
      details: { description: updated.description, status: updated.status },
    });
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
    const removed = await deleteFinTransaction(user.company_id, id);
    if (!removed) return apiNotFound("Transação");
    await logActivity({ user, action: "fin_transaction.delete", entityType: "fin_transaction", entityId: id });
    return apiSuccess({ id });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    if (error instanceof Error && error.message === "Forbidden") return apiForbidden();
    return apiServerError(error);
  }
}
