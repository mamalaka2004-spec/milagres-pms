import { NextRequest } from "next/server";
import { setPropertyAmenities } from "@/lib/db/queries/properties";
import { requireRole } from "@/lib/auth";
import { apiSuccess, apiError, apiUnauthorized, apiForbidden, apiServerError } from "@/lib/api/response";

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireRole(["admin", "manager"]);
    const { id } = await params;
    const { amenity_ids } = await request.json();
    if (!Array.isArray(amenity_ids)) return apiError("amenity_ids must be an array", 400);
    await setPropertyAmenities(id, amenity_ids);
    return apiSuccess({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    if (error instanceof Error && error.message === "Forbidden") return apiForbidden();
    return apiServerError(error);
  }
}
