import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { apiSuccess, apiUnauthorized, apiServerError } from "@/lib/api/response";
import { getCashFlow } from "@/lib/db/queries/fin";

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth();
    const monthsParam = req.nextUrl.searchParams.get("months");
    const monthsNum = monthsParam ? Number(monthsParam) : NaN;
    const months = Number.isFinite(monthsNum) ? Math.min(36, Math.max(3, monthsNum)) : 12;
    const data = await getCashFlow(user.company_id, months);
    return apiSuccess(data);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    return apiServerError(error);
  }
}
