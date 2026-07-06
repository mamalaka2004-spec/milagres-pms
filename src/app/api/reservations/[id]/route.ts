import { NextRequest } from "next/server";
import {
  reservationUpdateSchema,
  calculateReservationTotals,
} from "@/lib/validations/reservation";
import {
  getReservationById,
  updateReservation,
  checkAvailability,
  deleteReservation,
} from "@/lib/db/queries/reservations";
import { requireFullAccess, requireRole } from "@/lib/auth";
import { rescheduleReservationTasks } from "@/lib/db/queries/tasks";
import { logActivity } from "@/lib/audit/log";
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

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireFullAccess();
    const { id } = await params;
    const reservation = await getReservationById(id);
    if (!reservation) return apiNotFound("Reservation");
    if (reservation.company_id !== user.company_id) return apiForbidden();
    return apiSuccess(reservation);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    if (error instanceof Error && error.message === "Forbidden") return apiForbidden();
    return apiServerError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireRole(["admin", "manager"]);
    const { id } = await params;

    const existing = await getReservationById(id);
    if (!existing) return apiNotFound("Reservation");
    if (existing.company_id !== user.company_id) return apiForbidden();

    const body = await request.json();
    const validation = reservationUpdateSchema.safeParse(body);
    if (!validation.success) {
      return apiError("Validation failed", 400, validation.error.flatten());
    }
    const data = validation.data;
    const update: Record<string, unknown> = {};

    // Plain fields
    for (const k of [
      "channel",
      "channel_ref",
      "num_guests",
      "num_adults",
      "num_children",
      "status",
      "payment_status",
      "special_requests",
      "internal_notes",
    ] as const) {
      if (data[k] !== undefined) update[k] = data[k];
    }

    // Date changes — re-check availability
    const newCheckIn = data.check_in_date ?? existing.check_in_date;
    const newCheckOut = data.check_out_date ?? existing.check_out_date;
    const propertyId = data.property_id ?? existing.property_id;
    if (
      data.check_in_date !== undefined ||
      data.check_out_date !== undefined ||
      data.property_id !== undefined
    ) {
      const availability = await checkAvailability({
        property_id: propertyId,
        check_in_date: newCheckIn,
        check_out_date: newCheckOut,
        exclude_reservation_id: id,
      });
      if (!availability.available) {
        return apiError("Dates not available for this property", 409, availability);
      }
      update.check_in_date = newCheckIn;
      update.check_out_date = newCheckOut;
      update.property_id = propertyId;
    }

    // Money changes — recompute cents + totals
    const moneyKeys = ["base_amount", "cleaning_fee", "extra_guest_fee", "discount", "platform_fee", "tax"] as const;
    const anyMoneyChange = moneyKeys.some((k) => data[k] !== undefined);
    if (anyMoneyChange) {
      const base_amount_cents =
        data.base_amount !== undefined ? Math.round(data.base_amount * 100) : existing.base_amount_cents;
      const cleaning_fee_cents =
        data.cleaning_fee !== undefined ? Math.round(data.cleaning_fee * 100) : existing.cleaning_fee_cents;
      const extra_guest_fee_cents =
        data.extra_guest_fee !== undefined
          ? Math.round(data.extra_guest_fee * 100)
          : existing.extra_guest_fee_cents;
      const discount_cents =
        data.discount !== undefined ? Math.round(data.discount * 100) : existing.discount_cents;
      const platform_fee_cents =
        data.platform_fee !== undefined ? Math.round(data.platform_fee * 100) : existing.platform_fee_cents;
      const tax_cents = data.tax !== undefined ? Math.round(data.tax * 100) : existing.tax_cents;

      const totals = calculateReservationTotals({
        base_amount_cents,
        cleaning_fee_cents,
        extra_guest_fee_cents,
        discount_cents,
        platform_fee_cents,
        tax_cents,
      });
      Object.assign(update, {
        base_amount_cents,
        cleaning_fee_cents,
        extra_guest_fee_cents,
        discount_cents,
        platform_fee_cents,
        tax_cents,
        ...totals,
      });
    }

    const reservation = await updateReservation(id, update);

    // Auto-agendamento (Fase 6): datas mudaram → reagenda tarefas pendentes de
    // limpeza/preparo desta reserva (non-fatal).
    if (update.check_in_date !== undefined || update.check_out_date !== undefined) {
      const fresh = await getReservationById(id).catch(() => null);
      if (fresh) {
        await rescheduleReservationTasks({
          id: fresh.id,
          company_id: fresh.company_id,
          property_id: fresh.property_id,
          check_in_date: fresh.check_in_date,
          check_out_date: fresh.check_out_date,
          property: fresh.property
            ? {
                check_in_time: fresh.property.check_in_time,
                check_out_time: fresh.property.check_out_time,
              }
            : null,
        }).catch(() => null);
      }
    }

    await logActivity({ user, action: "reservation.update", entityType: "reservation", entityId: id, details: { label: existing.booking_code } });
    return apiSuccess(reservation);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    if (error instanceof Error && error.message === "Forbidden") return apiForbidden();
    return apiServerError(error);
  }
}

// ─── DELETE /api/reservations/[id] ───
// Soft delete — reservations affect availability/calendar and are never
// physically removed. Status-transition logic is untouched.
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireRole(["admin"]);
    const { id } = await params;

    const existing = await getReservationById(id);
    if (!existing) return apiNotFound("Reservation");
    if (existing.company_id !== user.company_id) return apiForbidden();

    await deleteReservation(id);
    await logActivity({ user, action: "reservation.delete", entityType: "reservation", entityId: id, details: { label: existing.booking_code } });
    return apiSuccess({ deleted: true });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    if (error instanceof Error && error.message === "Forbidden") return apiForbidden();
    return apiServerError(error);
  }
}
