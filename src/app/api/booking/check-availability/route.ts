import { NextRequest } from "next/server";
import { z } from "zod";
import { getPropertyBySlug } from "@/lib/db/queries/properties";
import { checkAvailability } from "@/lib/db/queries/reservations";
import { apiSuccess, apiError, apiServerError } from "@/lib/api/response";

const bodySchema = z.object({
  slug: z.string().min(1),
  check_in_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  check_out_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validation = bodySchema.safeParse(body);
    if (!validation.success) {
      return apiError("Validation failed", 400, validation.error.flatten());
    }
    const { slug, check_in_date, check_out_date } = validation.data;
    if (check_out_date <= check_in_date) {
      return apiError("Check-out must be after check-in", 400);
    }

    const property = await getPropertyBySlug(slug);
    if (!property) return apiError("Property not found", 404);

    const result = await checkAvailability({
      property_id: property.id,
      check_in_date,
      check_out_date,
    });

    if (!result.available) {
      return apiSuccess({
        available: false,
        message:
          (result.conflicting_reservations?.length || 0) > 0
            ? "Já existe uma reserva nestas datas."
            : "Estas datas estão bloqueadas para esta propriedade.",
      });
    }

    return apiSuccess({ available: true });
  } catch (error) {
    return apiServerError(error);
  }
}
