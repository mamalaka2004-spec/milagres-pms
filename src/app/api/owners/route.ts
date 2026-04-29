import { NextRequest } from "next/server";
import { ownerSchema } from "@/lib/validations/owner";
import { getOwners, createOwner } from "@/lib/db/queries/owners";
import { requireAuth, requireRole } from "@/lib/auth";
import { apiSuccess, apiError, apiUnauthorized, apiForbidden, apiServerError } from "@/lib/api/response";

export async function GET() {
  try {
    const user = await requireAuth();
    const owners = await getOwners(user.company_id);
    return apiSuccess(owners);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    return apiServerError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireRole(["admin", "manager"]);
    const body = await request.json();
    const validation = ownerSchema.safeParse(body);
    if (!validation.success) return apiError("Validation failed", 400, validation.error.flatten());
    const owner = await createOwner({
      company_id: user.company_id,
      full_name: validation.data.full_name,
      email: validation.data.email || null,
      phone: validation.data.phone || null,
      document_number: validation.data.document_number || null,
      document_type: validation.data.document_type || null,
      notes: validation.data.notes || null,
      is_active: validation.data.is_active,
    });
    return apiSuccess(owner, 201);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    if (error instanceof Error && error.message === "Forbidden") return apiForbidden();
    return apiServerError(error);
  }
}
