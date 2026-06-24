import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncReservationPaymentStatus } from "@/lib/db/queries/payments";
import { mapStatus } from "@/lib/asaas/client";
import { apiSuccess, apiError, apiServerError } from "@/lib/api/response";

export const maxDuration = 30;

/**
 * Asaas webhook — receives payment events and syncs the matching payments row.
 * Configure in the Asaas panel: URL = https://<app>/api/webhooks/asaas, and set an
 * auth token (header `asaas-access-token`) equal to env ASAAS_WEBHOOK_TOKEN.
 * Events: PAYMENT_CONFIRMED, PAYMENT_RECEIVED, PAYMENT_OVERDUE, PAYMENT_REFUNDED, ...
 */
export async function POST(request: NextRequest) {
  try {
    const expected = process.env.ASAAS_WEBHOOK_TOKEN;
    if (expected) {
      const provided = request.headers.get("asaas-access-token") || "";
      if (provided !== expected) return apiError("Forbidden", 403);
    }

    const body = await request.json().catch(() => null) as {
      event?: string;
      payment?: { id?: string; status?: string };
    } | null;
    const charge = body?.payment;
    if (!charge?.id || !charge.status) return apiSuccess({ ignored: true });

    const supabase = createAdminClient();
    const { data: rows } = await supabase
      .from("payments")
      .select("id, reservation_id")
      .eq("external_id", charge.id)
      .limit(1);
    const row = (rows as { id: string; reservation_id: string }[] | null)?.[0];
    if (!row) return apiSuccess({ matched: false });

    const status = mapStatus(charge.status);
    const patch: Record<string, unknown> = {
      status,
      external_status: charge.status,
      synced_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    if (status === "completed") patch.paid_at = new Date().toISOString();

    await (supabase.from("payments") as any).update(patch).eq("id", row.id); // eslint-disable-line @typescript-eslint/no-explicit-any
    await syncReservationPaymentStatus(row.reservation_id);

    return apiSuccess({ matched: true, status });
  } catch (error) {
    return apiServerError(error);
  }
}
