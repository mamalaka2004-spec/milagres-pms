import { NextRequest } from "next/server";
import { ownershipCreateSchema } from "@/lib/validations/ownership";
import { assignOwnerToProperty, getOwnerById } from "@/lib/db/queries/owners";
import { getPropertyById } from "@/lib/db/queries/properties";
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

// Postgres unique_violation — the (property_id, owner_id) pair already exists.
function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "23505"
  );
}

// ─── POST /api/ownerships — associate an owner to a property (#11) ───
export async function POST(request: NextRequest) {
  try {
    const user = await requireRole(["admin", "manager"]);
    const body = await request.json();

    const validation = ownershipCreateSchema.safeParse(body);
    if (!validation.success) {
      return apiError("Validation failed", 400, validation.error.flatten());
    }
    const { property_id, owner_id, share_percentage, commission_percentage } = validation.data;

    // Tenant isolation: both sides must belong to the caller's company.
    const property = await getPropertyById(property_id);
    if (!property) return apiNotFound("Property");
    if (property.company_id !== user.company_id) return apiForbidden();

    const owner = await getOwnerById(owner_id);
    if (!owner) return apiNotFound("Owner");
    if (owner.company_id !== user.company_id) return apiForbidden();

    try {
      const row = await assignOwnerToProperty({
        property_id,
        owner_id,
        share_percentage,
        commission_percentage,
      });
      await logActivity({
        user,
        action: "ownership.create",
        entityType: "property_ownership",
        entityId: row.id,
        details: {
          property: property.name,
          owner: owner.full_name,
          share_percentage,
          commission_percentage,
        },
      });
      return apiSuccess(row, 201);
    } catch (error) {
      if (isUniqueViolation(error)) {
        return apiError("Este proprietário já está vinculado a este imóvel.", 409);
      }
      throw error;
    }
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    if (error instanceof Error && error.message === "Forbidden") return apiForbidden();
    return apiServerError(error);
  }
}
