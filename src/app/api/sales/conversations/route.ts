import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { requireLineAccess } from "@/lib/whatsapp/auth";
import { listSalesConversations } from "@/lib/db/queries/sales";
import {
  apiSuccess,
  apiError,
  apiUnauthorized,
  apiForbidden,
  apiServerError,
} from "@/lib/api/response";

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const { searchParams } = new URL(request.url);
    const lineId = searchParams.get("line_id");
    if (!lineId) return apiError("line_id is required", 400);

    const line = await requireLineAccess(user, lineId);
    if (line.purpose !== "sales") return apiError("This endpoint serves sales lines only", 400);

    const data = await listSalesConversations(lineId);
    return apiSuccess(data);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    if (error instanceof Error && error.message === "Forbidden") return apiForbidden();
    if (error instanceof Error && error.message === "LineNotFound") return apiError("Line not found", 404);
    return apiServerError(error);
  }
}
