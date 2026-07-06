import { NextRequest } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import {
  getNotificationPreferences,
  setNotificationPreference,
} from "@/lib/db/queries/notifications";
import { NOTIFICATION_TYPES } from "@/lib/notifications/types";
import {
  apiSuccess,
  apiError,
  apiUnauthorized,
  apiServerError,
} from "@/lib/api/response";

export const dynamic = "force-dynamic";

// GET /api/notifications/preferences — mapa { tipo: boolean } do usuário logado.
export async function GET() {
  try {
    const user = await requireAuth();
    const prefs = await getNotificationPreferences(user.id);
    return apiSuccess(prefs);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    return apiServerError(error);
  }
}

const bodySchema = z.object({
  type: z.enum(NOTIFICATION_TYPES),
  in_app: z.boolean(),
});

// PUT /api/notifications/preferences — liga/desliga um tipo para o usuário logado.
export async function PUT(request: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await request.json().catch(() => ({}));
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) return apiError("Validation failed", 400, parsed.error.flatten());

    await setNotificationPreference(user.company_id, user.id, parsed.data.type, parsed.data.in_app);
    const prefs = await getNotificationPreferences(user.id);
    return apiSuccess(prefs);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    return apiServerError(error);
  }
}
