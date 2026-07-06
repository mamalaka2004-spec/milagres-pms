import { NextRequest } from "next/server";
import { guestUpdateSchema } from "@/lib/validations/guest";
import { getGuestById, updateGuest, deleteGuest } from "@/lib/db/queries/guests";
import { requireFullAccess, requireRole } from "@/lib/auth";
import { logActivity } from "@/lib/audit/log";
import {
  apiSuccess,
  apiError,
  apiUnauthorized,
  apiForbidden,
  apiNotFound,
  apiServerError,
} from "@/lib/api/response";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireFullAccess();
    const { id } = await params;
    const guest = await getGuestById(id);
    if (!guest) return apiNotFound("Guest");
    if (guest.company_id !== user.company_id) return apiForbidden();
    return apiSuccess(guest);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    if (error instanceof Error && error.message === "Forbidden") return apiForbidden();
    return apiServerError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireRole(["admin", "manager", "staff"]);
    const { id } = await params;

    const existing = await getGuestById(id);
    if (!existing) return apiNotFound("Guest");
    if (existing.company_id !== user.company_id) return apiForbidden();

    const body = await request.json();
    const validation = guestUpdateSchema.safeParse(body);
    if (!validation.success) {
      return apiError("Validation failed", 400, validation.error.flatten());
    }

    const data = validation.data;
    const update: Record<string, unknown> = { ...data };
    // Normalize empty strings to null for nullable text fields
    for (const key of ["email", "phone", "document_number", "date_of_birth", "nationality", "city", "state", "country", "notes"]) {
      if (update[key] === "") update[key] = null;
    }

    const guest = await updateGuest(id, update);
    await logActivity({ user, action: "guest.update", entityType: "guest", entityId: id, details: { label: guest.full_name } });
    return apiSuccess(guest);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    if (error instanceof Error && error.message === "Forbidden") return apiForbidden();
    return apiServerError(error);
  }
}

// ─── DELETE /api/guests/[id] ───
// Hard delete: the guests table has no deleted_at column.
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireRole(["admin", "manager"]);
    const { id } = await params;

    const existing = await getGuestById(id);
    if (!existing) return apiNotFound("Guest");
    if (existing.company_id !== user.company_id) return apiForbidden();

    await deleteGuest(id);
    await logActivity({ user, action: "guest.delete", entityType: "guest", entityId: id, details: { label: existing.full_name } });
    return apiSuccess({ deleted: true });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    if (error instanceof Error && error.message === "Forbidden") return apiForbidden();
    return apiServerError(error);
  }
}
