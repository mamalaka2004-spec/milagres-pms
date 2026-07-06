import { NextRequest } from "next/server";
import { getFinanceSummary } from "@/lib/db/queries/finance";
import { requireFullAccess } from "@/lib/auth";
import { apiSuccess, apiUnauthorized, apiForbidden, apiServerError } from "@/lib/api/response";

export async function GET(request: NextRequest) {
  try {
    const user = await requireFullAccess();
    const { searchParams } = new URL(request.url);

    const today = new Date();
    const defaultFrom = new Date(today.getFullYear(), today.getMonth() - 5, 1)
      .toISOString()
      .slice(0, 10);
    const defaultTo = new Date(today.getFullYear(), today.getMonth() + 1, 0)
      .toISOString()
      .slice(0, 10);

    const from = searchParams.get("from") || defaultFrom;
    const to = searchParams.get("to") || defaultTo;

    const summary = await getFinanceSummary(user.company_id, from, to);
    return apiSuccess(summary);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    if (error instanceof Error && error.message === "Forbidden") return apiForbidden();
    return apiServerError(error);
  }
}
