import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { requireLineAccess } from "@/lib/whatsapp/auth";
import { getConversationById, markConversationRead } from "@/lib/db/queries/whatsapp";
import {
  apiSuccess,
  apiUnauthorized,
  apiForbidden,
  apiNotFound,
  apiServerError,
} from "@/lib/api/response";

interface Params {
  params: Promise<{ id: string }>;
}

export async function POST(_request: NextRequest, { params }: Params) {
  try {
    const user = await requireAuth();
    const { id } = await params;
    const conv = await getConversationById(id);
    if (!conv) return apiNotFound("Conversation");
    if (conv.company_id !== user.company_id) return apiForbidden();
    await requireLineAccess(user, conv.line_id);
    await markConversationRead(id);
    return apiSuccess({ ok: true });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    if (error instanceof Error && error.message === "Forbidden") return apiForbidden();
    return apiServerError(error);
  }
}
