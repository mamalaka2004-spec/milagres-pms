import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import { requireLineAccess } from "@/lib/whatsapp/auth";
import { getConnectionState, connectInstance, EVO_UNAUTHORIZED } from "@/lib/whatsapp/evolution";
import {
  apiSuccess,
  apiError,
  apiUnauthorized,
  apiForbidden,
  apiServerError,
} from "@/lib/api/response";

interface Params {
  params: Promise<{ id: string }>;
}

/**
 * Live connection status of a line's Evolution instance, plus (with ?connect=1) the
 * QR / pairing code to reconnect — so the user never has to open the Evolution panel.
 * Uses the line's own provider_token (falls back to env key inside evolution.ts).
 */
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const user = await requireRole(["admin", "manager"]);
    const { id } = await params;
    const line = await requireLineAccess(user, id);

    if (line.provider !== "evolution" || !line.provider_instance) {
      return apiError("Linha sem instância Evolution configurada", 400);
    }

    const key = line.provider_token || undefined;
    const wantConnect = new URL(request.url).searchParams.get("connect") === "1";

    try {
      const state = await getConnectionState(line.provider_instance, key);
      // Already connected, or caller only wants the status → return it.
      if (state === "open" || !wantConnect) {
        return apiSuccess({ authorized: true, connected: state === "open", state });
      }
      // Disconnected and the user asked to (re)connect → fetch a fresh QR / pairing code.
      const conn = await connectInstance(line.provider_instance, key);
      return apiSuccess({
        authorized: true,
        connected: conn.state === "open",
        state: conn.state,
        qr: conn.qrBase64 ?? null,
        pairingCode: conn.pairingCode ?? null,
      });
    } catch (e) {
      if (e instanceof Error && e.message === EVO_UNAUTHORIZED) {
        // The key doesn't authorize this instance — the UI prompts for the token.
        return apiSuccess({ authorized: false, connected: false, state: "unauthorized" });
      }
      throw e;
    }
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    if (error instanceof Error && (error.message === "Forbidden" || error.message === "LineNotFound")) return apiForbidden();
    return apiServerError(error);
  }
}
