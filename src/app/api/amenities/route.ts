import { getAllAmenities } from "@/lib/db/queries/properties";
import { requireAuth } from "@/lib/auth";
import { apiSuccess, apiUnauthorized, apiServerError } from "@/lib/api/response";

export async function GET() {
  try {
    const user = await requireAuth();
    const amenities = await getAllAmenities(user.company_id);
    return apiSuccess(amenities);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    return apiServerError(error);
  }
}
