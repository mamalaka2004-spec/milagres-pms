import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import {
  isGoogleCalendarConfigured,
  GOOGLE_OAUTH_SCOPES,
} from "@/lib/calendar/google";
import {
  apiError,
  apiUnauthorized,
  apiForbidden,
  apiServerError,
} from "@/lib/api/response";

/**
 * Início do fluxo de conexão de um anúncio ao Google Calendar (#25) — STUB.
 *
 * BLOQUEADO: enquanto o OAuth do Google não estiver configurado (client_id/
 * secret/redirect), responde 501. TODO: quando configurado, gerar a URL de
 * consentimento (getAuthUrl) e redirecionar; o callback troca o code por tokens
 * e grava em google_calendar_connections.
 */
export async function POST(_request: NextRequest) {
  try {
    await requireRole(["admin", "manager"]);
    if (!isGoogleCalendarConfigured()) {
      return apiError(
        "Integração Google Calendar indisponível: requer credenciais Google OAuth (client_id, client_secret e redirect URI verificado).",
        501,
        { required_env: ["GOOGLE_OAUTH_CLIENT_ID", "GOOGLE_OAUTH_CLIENT_SECRET", "GOOGLE_OAUTH_REDIRECT_URI"], scopes: GOOGLE_OAUTH_SCOPES }
      );
    }
    // TODO(#25): const url = getAuthUrl({ connectionId, propertyId }); return apiSuccess({ auth_url: url });
    return apiError("Fluxo OAuth ainda não implementado.", 501);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    if (error instanceof Error && error.message === "Forbidden") return apiForbidden();
    return apiServerError(error);
  }
}
