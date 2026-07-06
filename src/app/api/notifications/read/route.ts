import { NextRequest } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { markNotificationsRead } from "@/lib/db/queries/notifications";
import {
  apiSuccess,
  apiError,
  apiUnauthorized,
  apiServerError,
} from "@/lib/api/response";

const bodySchema = z
  .object({
    id: z.string().uuid().optional(),
    all: z.boolean().optional(),
  })
  .refine((d) => d.all === true || !!d.id, {
    message: "Informe 'id' ou 'all: true'",
  });

// POST /api/notifications/read — marca uma (id) ou todas (all) como lidas.
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await request.json().catch(() => ({}));
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) return apiError("Validation failed", 400, parsed.error.flatten());

    const unread = await markNotificationsRead(user.id, parsed.data);
    return apiSuccess({ unread });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    return apiServerError(error);
  }
}
