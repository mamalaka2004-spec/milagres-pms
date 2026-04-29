import { NextRequest } from "next/server";
import { paymentUpdateSchema } from "@/lib/validations/payment";
import {
  updatePayment,
  syncReservationPaymentStatus,
} from "@/lib/db/queries/payments";
import { createServerClient } from "@/lib/supabase/server";
import { createEntry } from "@/lib/db/queries/finance";
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

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireRole(["admin", "manager"]);
    const { id } = await params;
    const supabase = await createServerClient();

    const { data: existingRow, error: fetchErr } = await supabase
      .from("payments")
      .select("*")
      .eq("id", id)
      .single();
    if (fetchErr || !existingRow) return apiNotFound("Payment");
    const existing = existingRow as {
      id: string;
      company_id: string;
      reservation_id: string;
      amount_cents: number;
      status: "pending" | "completed" | "failed" | "refunded";
    };
    if (existing.company_id !== user.company_id) return apiForbidden();

    const body = await request.json();
    const validation = paymentUpdateSchema.safeParse(body);
    if (!validation.success) {
      return apiError("Validation failed", 400, validation.error.flatten());
    }
    const data = validation.data;

    const patch: Record<string, unknown> = {};
    if (data.amount !== undefined) patch.amount_cents = Math.round(data.amount * 100);
    if (data.method !== undefined) patch.method = data.method;
    if (data.status !== undefined) patch.status = data.status;
    if (data.reference !== undefined) patch.reference = data.reference || null;
    if (data.paid_at !== undefined) patch.paid_at = data.paid_at || null;
    if (data.notes !== undefined) patch.notes = data.notes || null;

    const updated = await updatePayment(id, patch);

    // If status moved to refunded, log a refund entry
    if (existing.status !== "refunded" && updated.status === "refunded") {
      try {
        await createEntry({
          company_id: user.company_id,
          reservation_id: existing.reservation_id,
          type: "refund",
          category: updated.method,
          description: `Refund for payment ${id}`,
          amount_cents: updated.amount_cents,
          date: new Date().toISOString().slice(0, 10),
          created_by: user.id,
        });
      } catch {
        // non-fatal
      }
    }

    await syncReservationPaymentStatus(existing.reservation_id);
    return apiSuccess(updated);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    if (error instanceof Error && error.message === "Forbidden") return apiForbidden();
    return apiServerError(error);
  }
}
