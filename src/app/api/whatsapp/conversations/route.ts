import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { requireLineAccess } from "@/lib/whatsapp/auth";
import { listConversations } from "@/lib/db/queries/whatsapp";
import {
  apiSuccess,
  apiError,
  apiUnauthorized,
  apiForbidden,
  apiServerError,
} from "@/lib/api/response";
import type { WaConversationStatus } from "@/types/database";

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const { searchParams } = new URL(request.url);
    const lineId = searchParams.get("line_id");
    if (!lineId) return apiError("line_id is required", 400);

    await requireLineAccess(user, lineId);

    const status = searchParams.get("status") as WaConversationStatus | null;
    const conversations = await listConversations(lineId, {
      status: status || undefined,
      unread_only: searchParams.get("unread") === "1",
      search: searchParams.get("q") || undefined,
    });
    return apiSuccess(conversations);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    if (error instanceof Error && error.message === "Forbidden") return apiForbidden();
    if (error instanceof Error && error.message === "LineNotFound") return apiError("Line not found", 404);
    return apiServerError(error);
  }
}
