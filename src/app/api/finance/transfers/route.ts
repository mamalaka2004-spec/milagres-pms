import { NextRequest } from "next/server";
import { requireAuth, requireRole } from "@/lib/auth";
import { logActivity } from "@/lib/audit/log";
import { apiSuccess, apiError, apiUnauthorized, apiForbidden, apiServerError } from "@/lib/api/response";
import { createFinTransfer, listFinTransfers } from "@/lib/db/queries/fin";
import { finTransferSchema } from "@/lib/validations/finance";

export async function GET(_req: NextRequest) {
  try {
    const user = await requireAuth();
    const data = await listFinTransfers(user.company_id);
    return apiSuccess(data);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    return apiServerError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireRole(["admin", "manager"]);
    const parsed = finTransferSchema.safeParse(await req.json());
    if (!parsed.success) return apiError("Dados inválidos", 400, parsed.error.flatten());
    const { amount, ...rest } = parsed.data;
    const transfer = await createFinTransfer(user.company_id, {
      ...rest,
      amount_cents: Math.round(amount * 100),
      created_by: user.id,
    });
    await logActivity({
      user,
      action: "fin_transfer.create",
      entityType: "fin_transfer",
      entityId: transfer.id,
      details: { amount_cents: transfer.amount_cents, date: transfer.date },
    });
    return apiSuccess(transfer);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    if (error instanceof Error && error.message === "Forbidden") return apiForbidden();
    return apiServerError(error);
  }
}
