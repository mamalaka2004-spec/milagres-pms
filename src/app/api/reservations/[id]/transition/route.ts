import { NextRequest } from "next/server";
import { statusTransitionSchema } from "@/lib/validations/reservation";
import {
  getReservationById,
  transitionReservationStatus,
} from "@/lib/db/queries/reservations";
import { recomputeGuestStats } from "@/lib/db/queries/guests";
import { ensureCheckoutCleaningTask } from "@/lib/db/queries/tasks";
import { requireRole } from "@/lib/auth";
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

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireRole(["admin", "manager", "staff"]);
    const { id } = await params;

    const existing = await getReservationById(id);
    if (!existing) return apiNotFound("Reservation");
    if (existing.company_id !== user.company_id) return apiForbidden();

    const body = await request.json();
    const validation = statusTransitionSchema.safeParse(body);
    if (!validation.success) {
      return apiError("Validation failed", 400, validation.error.flatten());
    }
    const { status, cancellation_reason } = validation.data;

    const updated = await transitionReservationStatus(id, status, {
      cancellation_reason,
    });

    // Refresh guest stats if reservation reached confirmed/checked_in/checked_out
    // or if it left those states (canceled).
    if (
      ["confirmed", "checked_in", "checked_out", "canceled"].includes(status) ||
      ["confirmed", "checked_in", "checked_out"].includes(existing.status)
    ) {
      try {
        await recomputeGuestStats(existing.guest_id);
      } catch {
        // non-fatal
      }
    }

    // When a guest checks out, queue a cleaning task if one doesn't exist yet.
    if (status === "checked_out") {
      try {
        await ensureCheckoutCleaningTask({
          id: existing.id,
          company_id: existing.company_id,
          property_id: existing.property_id,
          check_out_date: existing.check_out_date,
          property: existing.property
            ? { check_out_time: existing.property.check_out_time }
            : null,
        });
      } catch {
        // non-fatal: cleaning task can be created manually
      }
    }

    return apiSuccess(updated);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    if (error instanceof Error && error.message === "Forbidden") return apiForbidden();
    if (error instanceof Error && error.message.startsWith("Cannot transition")) {
      return apiError(error.message, 409);
    }
    return apiServerError(error);
  }
}
