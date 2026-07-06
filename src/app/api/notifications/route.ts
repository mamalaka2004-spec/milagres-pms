import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { listNotifications } from "@/lib/db/queries/notifications";
import {
  apiSuccess,
  apiUnauthorized,
  apiServerError,
} from "@/lib/api/response";

export const dynamic = "force-dynamic";

// GET /api/notifications?limit=&before=
// Retorna as notificações do usuário logado + contador de não-lidas.
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const { searchParams } = new URL(request.url);
    const limitParam = Number(searchParams.get("limit"));
    const result = await listNotifications(user.id, {
      limit: Number.isFinite(limitParam) && limitParam > 0 ? limitParam : undefined,
      before: searchParams.get("before") || undefined,
    });
    return apiSuccess(result);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    return apiServerError(error);
  }
}
