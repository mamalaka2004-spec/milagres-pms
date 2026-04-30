import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { requireLineAccess } from "@/lib/whatsapp/auth";
import { getConversationById, updateConversation } from "@/lib/db/queries/whatsapp";
import { conversationPatchSchema } from "@/lib/validations/whatsapp";
import { getReservationById } from "@/lib/db/queries/reservations";
import {
  apiSuccess,
  apiError,
  apiUnauthorized,
  apiForbidden,
  apiNotFound,
  apiServerError,
} from "@/lib/api/response";

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const user = await requireAuth();
    const { id } = await params;
    const conv = await getConversationById(id);
    if (!conv) return apiNotFound("Conversation");
    if (conv.company_id !== user.company_id) return apiForbidden();
    await requireLineAccess(user, conv.line_id);
    return apiSuccess(conv);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    if (error instanceof Error && error.message === "Forbidden") return apiForbidden();
    return apiServerError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const user = await requireAuth();
    const { id } = await params;
    const conv = await getConversationById(id);
    if (!conv) return apiNotFound("Conversation");
    if (conv.company_id !== user.company_id) return apiForbidden();
    await requireLineAccess(user, conv.line_id);

    const body = await request.json();
    const validation = conversationPatchSchema.safeParse(body);
    if (!validation.success) return apiError("Validation failed", 400, validation.error.flatten());
    const patch = validation.data;

    // If linking a reservation, ensure it belongs to the same company.
    if (patch.reservation_id) {
      const r = await getReservationById(patch.reservation_id);
      if (!r) return apiError("Reservation not found", 404);
      if (r.company_id !== user.company_id) return apiForbidden();
    }

    const updated = await updateConversation(id, patch);
    return apiSuccess(updated);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    if (error instanceof Error && error.message === "Forbidden") return apiForbidden();
    return apiServerError(error);
  }
}
