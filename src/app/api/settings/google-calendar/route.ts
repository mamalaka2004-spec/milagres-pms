import { requireRole } from "@/lib/auth";
import { listConnections, isGoogleCalendarConfigured } from "@/lib/calendar/google";
import {
  apiSuccess,
  apiUnauthorized,
  apiForbidden,
  apiServerError,
} from "@/lib/api/response";

/**
 * Google Calendar bidirecional (#25) — SCAFFOLD.
 * Lista as conexões existentes por anúncio e informa se o OAuth do Google está
 * configurado no ambiente (enquanto false, a UI fica em modo "requer credenciais").
 */
export async function GET() {
  try {
    const user = await requireRole(["admin", "manager"]);
    const connections = await listConnections(user.company_id);
    return apiSuccess({
      configured: isGoogleCalendarConfigured(),
      connections,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    if (error instanceof Error && error.message === "Forbidden") return apiForbidden();
    return apiServerError(error);
  }
}
