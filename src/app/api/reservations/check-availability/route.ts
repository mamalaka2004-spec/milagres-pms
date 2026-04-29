import { NextRequest } from "next/server";
import { availabilityCheckSchema } from "@/lib/validations/reservation";
import { checkAvailability } from "@/lib/db/queries/reservations";
import { requireAuth } from "@/lib/auth";
import {
  apiSuccess,
  apiError,
  apiUnauthorized,
  apiServerError,
} from "@/lib/api/response";

export async function POST(request: NextRequest) {
  try {
    await requireAuth();
    const body = await request.json();
    const validation = availabilityCheckSchema.safeParse(body);
    if (!validation.success) {
      return apiError("Validation failed", 400, validation.error.flatten());
    }
    const result = await checkAvailability(validation.data);
    return apiSuccess(result);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    return apiServerError(error);
  }
}
