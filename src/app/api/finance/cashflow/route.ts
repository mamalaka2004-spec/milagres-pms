import { NextRequest } from "next/server";
import { requireFullAccess } from "@/lib/auth";
import { apiSuccess, apiUnauthorized, apiForbidden, apiServerError } from "@/lib/api/response";
import { getCashFlow } from "@/lib/db/queries/fin";

export async function GET(req: NextRequest) {
  try {
    const user = await requireFullAccess();
    const monthsParam = req.nextUrl.searchParams.get("months");
    const monthsNum = monthsParam ? Number(monthsParam) : NaN;
    const months = Number.isFinite(monthsNum) ? Math.min(36, Math.max(3, monthsNum)) : 12;
    const data = await getCashFlow(user.company_id, months);
    return apiSuccess(data);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    if (error instanceof Error && error.message === "Forbidden") return apiForbidden();
    return apiServerError(error);
  }
}
