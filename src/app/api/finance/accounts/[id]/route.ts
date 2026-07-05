import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import { logActivity } from "@/lib/audit/log";
import { apiSuccess, apiError, apiUnauthorized, apiForbidden, apiNotFound, apiServerError } from "@/lib/api/response";
import { deleteBankAccount, updateBankAccount } from "@/lib/db/queries/fin";
import { bankAccountUpdateSchema } from "@/lib/validations/finance";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const user = await requireRole(["admin", "manager"]);
    const { id } = await params;
    const parsed = bankAccountUpdateSchema.safeParse(await req.json());
    if (!parsed.success) return apiError("Dados inválidos", 400, parsed.error.flatten());
    const { opening_balance, ...rest } = parsed.data;
    const input = {
      ...rest,
      ...(opening_balance !== undefined
        ? { opening_balance_cents: Math.round(opening_balance * 100) }
        : {}),
    };
    const updated = await updateBankAccount(user.company_id, id, input);
    if (!updated) return apiNotFound("Conta");
    await logActivity({
      user,
      action: "fin_account.update",
      entityType: "bank_account",
      entityId: id,
      details: { name: updated.name },
    });
    return apiSuccess(updated);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    if (error instanceof Error && error.message === "Forbidden") return apiForbidden();
    if (error instanceof Error && /duplicate|unique/i.test(error.message)) {
      return apiError("Já existe uma conta com esse nome", 409);
    }
    return apiServerError(error);
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const user = await requireRole(["admin", "manager"]);
    const { id } = await params;
    const removed = await deleteBankAccount(user.company_id, id);
    if (!removed) return apiNotFound("Conta");
    await logActivity({ user, action: "fin_account.delete", entityType: "bank_account", entityId: id });
    return apiSuccess({ id });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    if (error instanceof Error && error.message === "Forbidden") return apiForbidden();
    return apiServerError(error);
  }
}
