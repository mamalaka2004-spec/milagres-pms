import { NextRequest } from "next/server";
import {
  reservationSchema,
  calculateReservationTotals,
} from "@/lib/validations/reservation";
import {
  getReservations,
  createReservation,
  checkAvailability,
  getNextBookingSequence,
} from "@/lib/db/queries/reservations";
import { requireAuth, requireRole } from "@/lib/auth";
import {
  apiSuccess,
  apiError,
  apiUnauthorized,
  apiForbidden,
  apiServerError,
} from "@/lib/api/response";

const BOOKING_PREFIX = "MIL";

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const { searchParams } = new URL(request.url);
    const reservations = await getReservations(user.company_id, {
      status: searchParams.get("status") || undefined,
      property_id: searchParams.get("property_id") || undefined,
      guest_id: searchParams.get("guest_id") || undefined,
      channel: searchParams.get("channel") || undefined,
      from_date: searchParams.get("from") || undefined,
      to_date: searchParams.get("to") || undefined,
      search: searchParams.get("search") || undefined,
    });
    return apiSuccess(reservations);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    return apiServerError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireRole(["admin", "manager", "staff"]);
    const body = await request.json();

    const validation = reservationSchema.safeParse(body);
    if (!validation.success) {
      return apiError("Validation failed", 400, validation.error.flatten());
    }
    const data = validation.data;

    // Availability gate
    const availability = await checkAvailability({
      property_id: data.property_id,
      check_in_date: data.check_in_date,
      check_out_date: data.check_out_date,
    });
    if (!availability.available) {
      return apiError("Dates not available for this property", 409, availability);
    }

    // Money: reais → cents
    const base_amount_cents = Math.round(data.base_amount * 100);
    const cleaning_fee_cents = Math.round(data.cleaning_fee * 100);
    const extra_guest_fee_cents = Math.round(data.extra_guest_fee * 100);
    const discount_cents = Math.round(data.discount * 100);
    const platform_fee_cents = Math.round(data.platform_fee * 100);
    const tax_cents = Math.round(data.tax * 100);
    const totals = calculateReservationTotals({
      base_amount_cents,
      cleaning_fee_cents,
      extra_guest_fee_cents,
      discount_cents,
      platform_fee_cents,
      tax_cents,
    });

    // Booking code
    const year = new Date().getFullYear();
    const seq = await getNextBookingSequence(user.company_id, BOOKING_PREFIX, year);
    const booking_code = `${BOOKING_PREFIX}-${year}-${String(seq).padStart(4, "0")}`;

    const reservation = await createReservation({
      company_id: user.company_id,
      property_id: data.property_id,
      guest_id: data.guest_id,
      booking_code,
      channel: data.channel,
      channel_ref: data.channel_ref || null,
      check_in_date: data.check_in_date,
      check_out_date: data.check_out_date,
      num_guests: data.num_guests,
      num_adults: data.num_adults,
      num_children: data.num_children,
      status: data.status,
      payment_status: data.payment_status,
      base_amount_cents,
      cleaning_fee_cents,
      extra_guest_fee_cents,
      discount_cents,
      platform_fee_cents,
      tax_cents,
      ...totals,
      special_requests: data.special_requests || null,
      internal_notes: data.internal_notes || null,
      created_by: user.id,
    });

    return apiSuccess(reservation, 201);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    if (error instanceof Error && error.message === "Forbidden") return apiForbidden();
    return apiServerError(error);
  }
}
