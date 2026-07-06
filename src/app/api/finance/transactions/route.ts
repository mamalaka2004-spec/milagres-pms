import { NextRequest } from "next/server";
import { requireFullAccess, requireRole } from "@/lib/auth";
import { logActivity } from "@/lib/audit/log";
import { apiSuccess, apiError, apiUnauthorized, apiForbidden, apiServerError } from "@/lib/api/response";
import { createFinTransaction, listFinTransactions, type FinTransactionFilters } from "@/lib/db/queries/fin";
import { finTransactionSchema, toTransactionRow } from "@/lib/validations/finance";

export async function GET(req: NextRequest) {
  try {
    const user = await requireFullAccess();
    const sp = req.nextUrl.searchParams;
    const pick = (key: string) => sp.get(key) || undefined;
    const filters: FinTransactionFilters = {
      from: pick("from"),
      to: pick("to"),
      type: (pick("type") as FinTransactionFilters["type"]) || undefined,
      status: (pick("status") as FinTransactionFilters["status"]) || undefined,
      bank_account_id: pick("bank_account_id"),
      category_id: pick("category_id"),
      cost_center_id: pick("cost_center_id"),
      q: pick("q"),
    };
    const data = await listFinTransactions(user.company_id, filters);
    return apiSuccess(data);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    if (error instanceof Error && error.message === "Forbidden") return apiForbidden();
    return apiServerError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireRole(["admin", "manager"]);
    const parsed = finTransactionSchema.safeParse(await req.json());
    if (!parsed.success) return apiError("Dados inválidos", 400, parsed.error.flatten());
    const tx = await createFinTransaction(user.company_id, {
      ...toTransactionRow(parsed.data),
      created_by: user.id,
    });
    await logActivity({
      user,
      action: "fin_transaction.create",
      entityType: "fin_transaction",
      entityId: tx.id,
      details: { type: tx.type, amount_cents: tx.amount_cents, description: tx.description },
    });
    return apiSuccess(tx);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    if (error instanceof Error && error.message === "Forbidden") return apiForbidden();
    return apiServerError(error);
  }
}
