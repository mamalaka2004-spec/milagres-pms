import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import { getActivityLogs } from "@/lib/db/queries/activity";
import { apiSuccess, apiUnauthorized, apiForbidden, apiServerError } from "@/lib/api/response";

/** GET /api/activity-logs — paginated activity feed (admin/manager only). */
export async function GET(request: NextRequest) {
  try {
    const user = await requireRole(["admin", "manager"]);
    const sp = new URL(request.url).searchParams;
    const logs = await getActivityLogs(user.company_id, {
      entityType: sp.get("entityType") || undefined,
      userId: sp.get("userId") || undefined,
      before: sp.get("before") || undefined,
      limit: sp.get("limit") ? Number(sp.get("limit")) : undefined,
    });
    return apiSuccess(logs);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    if (error instanceof Error && error.message === "Forbidden") return apiForbidden();
    return apiServerError(error);
  }
}
