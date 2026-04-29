import { NextRequest } from "next/server";
import { guestSchema } from "@/lib/validations/guest";
import { createGuest, getGuests, findGuestByEmailOrPhone } from "@/lib/db/queries/guests";
import { requireAuth, requireRole } from "@/lib/auth";
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
    const guests = await getGuests(user.company_id, {
      search: searchParams.get("search") || undefined,
      is_vip: searchParams.get("vip") === "true" ? true : undefined,
    });
    return apiSuccess(guests);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return apiUnauthorized();
    }
    return apiServerError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireRole(["admin", "manager", "staff"]);
    const body = await request.json();

    const validation = guestSchema.safeParse(body);
    if (!validation.success) {
      return apiError("Validation failed", 400, validation.error.flatten());
    }
    const data = validation.data;

    // Dedup: try to find existing guest by email or phone
    if (data.email || data.phone) {
      const existing = await findGuestByEmailOrPhone(
        user.company_id,
        data.email || null,
        data.phone || null
      );
      if (existing) {
        return apiSuccess({ ...existing, _matched_existing: true }, 200);
      }
    }

    const guest = await createGuest({
      company_id: user.company_id,
      full_name: data.full_name,
      email: data.email || null,
      phone: data.phone || null,
      document_number: data.document_number || null,
      document_type: data.document_type || null,
      date_of_birth: data.date_of_birth || null,
      nationality: data.nationality || null,
      city: data.city || null,
      state: data.state || null,
      country: data.country || null,
      language: data.language,
      notes: data.notes || null,
      tags: data.tags || null,
      is_vip: data.is_vip,
      total_stays: 0,
      total_spent_cents: 0,
    });

    return apiSuccess(guest, 201);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    if (error instanceof Error && error.message === "Forbidden") return apiForbidden();
    return apiServerError(error);
  }
}
