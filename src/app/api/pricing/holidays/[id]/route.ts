import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import { logActivity } from "@/lib/audit/log";
import { apiSuccess, apiUnauthorized, apiForbidden, apiNotFound, apiServerError } from "@/lib/api/response";
import { deleteHoliday } from "@/lib/db/queries/pricing";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireRole(["admin", "manager"]);
    const { id } = await params;
    const deleted = await deleteHoliday(user.company_id, id);
    if (!deleted) return apiNotFound("Feriado");
    await logActivity({ user, action: "holiday.delete", entityType: "holiday", entityId: id, details: {} });
    return apiSuccess({ deleted: true });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    if (error instanceof Error && error.message === "Forbidden") return apiForbidden();
    return apiServerError(error);
  }
}
