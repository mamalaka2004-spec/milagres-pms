import { NextRequest } from "next/server";
import { propertySchema } from "@/lib/validations/property";
import { getProperties, createProperty } from "@/lib/db/queries/properties";
import { requireAuth, requireRole } from "@/lib/auth";
import { apiSuccess, apiError, apiUnauthorized, apiServerError } from "@/lib/api/response";

// ─── GET /api/properties ───
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const { searchParams } = new URL(request.url);

    const filters = {
      status: searchParams.get("status") || undefined,
      search: searchParams.get("search") || undefined,
      is_featured: searchParams.get("featured") === "true" ? true : undefined,
    };

    const properties = await getProperties(user.company_id, filters);
    return apiSuccess(properties);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return apiUnauthorized();
    }
    return apiServerError(error);
  }
}

// ─── POST /api/properties ───
export async function POST(request: NextRequest) {
  try {
    const user = await requireRole(["admin", "manager"]);
    const body = await request.json();

    const validation = propertySchema.safeParse(body);
    if (!validation.success) {
      return apiError("Validation failed", 400, validation.error.flatten());
    }

    const data = validation.data;

    const property = await createProperty({
      company_id: user.company_id,
      name: data.name,
      code: data.code,
      slug: data.slug,
      status: data.status,
      type: data.type || null,
      address: data.address || null,
      neighborhood: data.neighborhood || null,
      city: data.city || null,
      state: data.state || null,
      country: data.country,
      zip_code: data.zip_code || null,
      latitude: data.latitude || null,
      longitude: data.longitude || null,
      max_guests: data.max_guests,
      bedrooms: data.bedrooms,
      beds: data.beds,
      bathrooms: data.bathrooms,
      title: data.title || null,
      subtitle: data.subtitle || null,
      description: data.description || null,
      short_description: data.short_description || null,
      house_rules: data.house_rules || null,
      cancellation_policy: data.cancellation_policy || null,
      check_in_time: data.check_in_time,
      check_out_time: data.check_out_time,
      min_nights: data.min_nights,
      max_nights: data.max_nights,
      base_price_cents: Math.round(data.base_price * 100),
      cleaning_fee_cents: Math.round(data.cleaning_fee * 100),
      extra_guest_fee_cents: Math.round(data.extra_guest_fee * 100),
      extra_guest_after: data.extra_guest_after,
      instant_booking_enabled: data.instant_booking_enabled,
      is_featured: data.is_featured,
      meta_title: data.meta_title || null,
      meta_description: data.meta_description || null,
      cover_image_url: null,
      airbnb_ical_url: data.airbnb_ical_url || null,
      booking_ical_url: data.booking_ical_url || null,
      airbnb_listing_url: data.airbnb_listing_url || null,
      booking_listing_url: data.booking_listing_url || null,
    });

    return apiSuccess(property, 201);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    if (error instanceof Error && error.message === "Forbidden") {
      return apiError("Forbidden", 403);
    }
    return apiServerError(error);
  }
}
