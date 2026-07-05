import { NextRequest } from "next/server";
import { requireAuth, requireRole } from "@/lib/auth";
import { logActivity } from "@/lib/audit/log";
import { apiSuccess, apiError, apiUnauthorized, apiForbidden, apiServerError } from "@/lib/api/response";
import { createBankAccount, listBankAccountsWithBalances } from "@/lib/db/queries/fin";
import { bankAccountSchema } from "@/lib/validations/finance";

export async function GET(_req: NextRequest) {
  try {
    const user = await requireAuth();
    const data = await listBankAccountsWithBalances(user.company_id);
    return apiSuccess(data);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    return apiServerError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireRole(["admin", "manager"]);
    const parsed = bankAccountSchema.safeParse(await req.json());
    if (!parsed.success) return apiError("Dados inválidos", 400, parsed.error.flatten());
    const { opening_balance, ...rest } = parsed.data;
    const account = await createBankAccount(user.company_id, {
      ...rest,
      opening_balance_cents: Math.round(opening_balance * 100),
    });
    await logActivity({
      user,
      action: "fin_account.create",
      entityType: "bank_account",
      entityId: account.id,
      details: { name: account.name, type: account.type },
    });
    return apiSuccess(account);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    if (error instanceof Error && error.message === "Forbidden") return apiForbidden();
    if (error instanceof Error && /duplicate|unique/i.test(error.message)) {
      return apiError("Já existe uma conta com esse nome", 409);
    }
    return apiServerError(error);
  }
}
