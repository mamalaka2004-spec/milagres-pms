import { NextRequest } from "next/server";
import { ownerSchema } from "@/lib/validations/owner";
import { getOwnerById, updateOwner } from "@/lib/db/queries/owners";
import { requireAuth, requireRole } from "@/lib/auth";
import { apiSuccess, apiError, apiUnauthorized, apiForbidden, apiNotFound, apiServerError } from "@/lib/api/response";

interface Params { params: Promise<{ id: string }> }

export async function GET(_: NextRequest, { params }: Params) {
  try {
    const user = await requireAuth();
    const { id } = await params;
    const owner = await getOwnerById(id);
    if (!owner) return apiNotFound("Owner");
    if (owner.company_id !== user.company_id) return apiForbidden();
    return apiSuccess(owner);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    return apiServerError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const user = await requireRole(["admin", "manager"]);
    const { id } = await params;
    const existing = await getOwnerById(id);
    if (!existing) return apiNotFound("Owner");
    if (existing.company_id !== user.company_id) return apiForbidden();
    const body = await request.json();
    const validation = ownerSchema.partial().safeParse(body);
    if (!validation.success) return apiError("Validation failed", 400, validation.error.flatten());
    const owner = await updateOwner(id, {
      ...validation.data,
      email: validation.data.email === "" ? null : validation.data.email,
    });
    return apiSuccess(owner);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    if (error instanceof Error && error.message === "Forbidden") return apiForbidden();
    return apiServerError(error);
  }
}
