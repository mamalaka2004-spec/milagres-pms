import { NextRequest } from "next/server";
import { paymentSchema } from "@/lib/validations/payment";
import {
  createPayment,
  syncReservationPaymentStatus,
  listPaymentsForCompany,
} from "@/lib/db/queries/payments";
import { getReservationById } from "@/lib/db/queries/reservations";
import { createEntry } from "@/lib/db/queries/finance";
import { requireRole, requireAuth } from "@/lib/auth";
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
    const data = await listPaymentsForCompany(user.company_id, {
      from: searchParams.get("from") || undefined,
      to: searchParams.get("to") || undefined,
      status: searchParams.get("status") || undefined,
    });
    return apiSuccess(data);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    return apiServerError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireRole(["admin", "manager", "staff"]);
    const body = await request.json();
    const validation = paymentSchema.safeParse(body);
    if (!validation.success) {
      return apiError("Validation failed", 400, validation.error.flatten());
    }
    const data = validation.data;

    // Verify reservation belongs to the user's company
    const reservation = await getReservationById(data.reservation_id);
    if (!reservation) return apiError("Reservation not found", 404);
    if (reservation.company_id !== user.company_id) return apiForbidden();

    const amount_cents = Math.round(data.amount * 100);
    const paid_at =
      data.status === "completed"
        ? data.paid_at || new Date().toISOString()
        : data.paid_at || null;

    const payment = await createPayment({
      company_id: user.company_id,
      reservation_id: data.reservation_id,
      amount_cents,
      method: data.method,
      status: data.status,
      reference: data.reference || null,
      paid_at,
      notes: data.notes || null,
      created_by: user.id,
    });

    // Auto-create a financial revenue entry when a completed payment is recorded.
    // Refunds are tracked separately (see PATCH route below).
    if (data.status === "completed") {
      try {
        await createEntry({
          company_id: user.company_id,
          reservation_id: data.reservation_id,
          property_id: reservation.property_id,
          type: "revenue",
          category: data.method,
          description: `Payment ${reservation.booking_code} via ${data.method}`,
          amount_cents,
          date: (paid_at || new Date().toISOString()).slice(0, 10),
          created_by: user.id,
        });
      } catch {
        // non-fatal: payment is recorded; entry can be reconciled later
      }
    }

    // Recompute reservation.payment_status
    await syncReservationPaymentStatus(data.reservation_id);

    return apiSuccess(payment, 201);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    if (error instanceof Error && error.message === "Forbidden") return apiForbidden();
    return apiServerError(error);
  }
}
