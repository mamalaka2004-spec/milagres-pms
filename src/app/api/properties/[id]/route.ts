import { NextRequest } from "next/server";
import { propertyUpdateSchema } from "@/lib/validations/property";
import {
  getPropertyById,
  updateProperty,
  deleteProperty,
} from "@/lib/db/queries/properties";
import { requireAuth, requireRole } from "@/lib/auth";
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

// ─── GET /api/properties/[id] ───
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    const { id } = await params;

    const property = await getPropertyById(id);
    if (!property) return apiNotFound("Property");

    if (property.company_id !== user.company_id) return apiForbidden();

    return apiSuccess(property);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    return apiServerError(error);
  }
}

// ─── PATCH /api/properties/[id] ───
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireRole(["admin", "manager"]);
    const { id } = await params;

    const existing = await getPropertyById(id);
    if (!existing) return apiNotFound("Property");
    if (existing.company_id !== user.company_id) return apiForbidden();

    const body = await request.json();
    const validation = propertyUpdateSchema.safeParse(body);
    if (!validation.success) {
      return apiError("Validation failed", 400, validation.error.flatten());
    }

    const data = validation.data;

    // Map price fields from reais → cents if provided
    const updateData: Record<string, unknown> = { ...data };
    if (data.base_price !== undefined) {
      updateData.base_price_cents = Math.round(data.base_price * 100);
      delete updateData.base_price;
    }
    if (data.cleaning_fee !== undefined) {
      updateData.cleaning_fee_cents = Math.round(data.cleaning_fee * 100);
      delete updateData.cleaning_fee;
    }
    if (data.extra_guest_fee !== undefined) {
      updateData.extra_guest_fee_cents = Math.round(data.extra_guest_fee * 100);
      delete updateData.extra_guest_fee;
    }

    // Normalize empty channel-sync URLs to null so we don't store ""
    for (const k of [
      "airbnb_ical_url",
      "booking_ical_url",
      "airbnb_listing_url",
      "booking_listing_url",
    ]) {
      if (updateData[k] === "") updateData[k] = null;
    }

    const property = await updateProperty(id, updateData);
    return apiSuccess(property);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    if (error instanceof Error && error.message === "Forbidden") return apiForbidden();
    return apiServerError(error);
  }
}

// ─── DELETE /api/properties/[id] ───
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireRole(["admin"]);
    const { id } = await params;

    const existing = await getPropertyById(id);
    if (!existing) return apiNotFound("Property");
    if (existing.company_id !== user.company_id) return apiForbidden();

    await deleteProperty(id);
    return apiSuccess({ deleted: true });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    if (error instanceof Error && error.message === "Forbidden") return apiForbidden();
    return apiServerError(error);
  }
}
