import { NextRequest } from "next/server";
import { ownershipUpdateSchema } from "@/lib/validations/ownership";
import { getOwnershipScope, updateOwnership, removeOwnership } from "@/lib/db/queries/owners";
import { requireRole } from "@/lib/auth";
import { logActivity } from "@/lib/audit/log";
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

// ─── PATCH /api/ownerships/[id] — edit share/commission (#11) ───
export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const user = await requireRole(["admin", "manager"]);
    const { id } = await params;

    const scope = await getOwnershipScope(id);
    if (!scope) return apiNotFound("Ownership");
    if (scope.property?.company_id !== user.company_id) return apiForbidden();

    const body = await request.json();
    const validation = ownershipUpdateSchema.safeParse(body);
    if (!validation.success) {
      return apiError("Validation failed", 400, validation.error.flatten());
    }

    const row = await updateOwnership(id, validation.data);
    await logActivity({
      user,
      action: "ownership.update",
      entityType: "property_ownership",
      entityId: id,
      details: {
        property: scope.property?.name,
        owner: scope.owner?.full_name,
        ...validation.data,
      },
    });
    return apiSuccess(row);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    if (error instanceof Error && error.message === "Forbidden") return apiForbidden();
    return apiServerError(error);
  }
}

// ─── DELETE /api/ownerships/[id] — disassociate owner from property (#11) ───
export async function DELETE(_request: NextRequest, { params }: Params) {
  try {
    const user = await requireRole(["admin", "manager"]);
    const { id } = await params;

    const scope = await getOwnershipScope(id);
    if (!scope) return apiNotFound("Ownership");
    if (scope.property?.company_id !== user.company_id) return apiForbidden();

    await removeOwnership(id);
    await logActivity({
      user,
      action: "ownership.delete",
      entityType: "property_ownership",
      entityId: id,
      details: {
        property: scope.property?.name,
        owner: scope.owner?.full_name,
      },
    });
    return apiSuccess({ deleted: true });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    if (error instanceof Error && error.message === "Forbidden") return apiForbidden();
    return apiServerError(error);
  }
}
