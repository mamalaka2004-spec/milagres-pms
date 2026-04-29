import { createAdminClient } from "@/lib/supabase/admin";

export type PaymentMethod =
  | "pix"
  | "credit_card"
  | "debit_card"
  | "bank_transfer"
  | "cash"
  | "platform"
  | "other";

export type PaymentRowStatus = "pending" | "completed" | "failed" | "refunded";

export interface PaymentRow {
  id: string;
  company_id: string;
  reservation_id: string;
  amount_cents: number;
  method: PaymentMethod;
  status: PaymentRowStatus;
  reference: string | null;
  paid_at: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreatePaymentInput {
  company_id: string;
  reservation_id: string;
  amount_cents: number;
  method: PaymentMethod;
  status: PaymentRowStatus;
  reference?: string | null;
  paid_at?: string | null;
  notes?: string | null;
  created_by?: string | null;
}

export async function listPaymentsForReservation(
  reservationId: string
): Promise<PaymentRow[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("payments")
    .select("*")
    .eq("reservation_id", reservationId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data as unknown as PaymentRow[]) || [];
}

export async function listPaymentsForCompany(
  companyId: string,
  filters: { from?: string; to?: string; status?: string } = {}
) {
  const supabase = createAdminClient();
  let query = supabase
    .from("payments")
    .select(`
      *,
      reservation:reservations (
        id, booking_code, guest:guests (full_name), property:properties (id, name, code)
      )
    `)
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.from) query = query.gte("paid_at", filters.from);
  if (filters.to) query = query.lte("paid_at", `${filters.to}T23:59:59Z`);

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function createPayment(input: CreatePaymentInput): Promise<PaymentRow> {
  const supabase = createAdminClient();
  const { data, error } = await (supabase.from("payments") as any) // eslint-disable-line @typescript-eslint/no-explicit-any
    .insert(input)
    .select()
    .single();
  if (error) throw error;
  return data as PaymentRow;
}

export async function updatePayment(
  id: string,
  patch: Partial<CreatePaymentInput>
): Promise<PaymentRow> {
  const supabase = createAdminClient();
  const { data, error } = await (supabase.from("payments") as any) // eslint-disable-line @typescript-eslint/no-explicit-any
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as PaymentRow;
}

/**
 * Recalculate a reservation's payment_status based on completed payments.
 * Returns the new status without updating; caller decides if/when to persist.
 */
export async function computePaymentStatusForReservation(
  reservationId: string
): Promise<{ paid_cents: number; total_cents: number; status: "unpaid" | "partially_paid" | "paid" | "refunded" }> {
  const supabase = createAdminClient();

  const [{ data: r, error: rErr }, { data: paymentsData, error: pErr }] = await Promise.all([
    supabase
      .from("reservations")
      .select("total_cents")
      .eq("id", reservationId)
      .single(),
    supabase
      .from("payments")
      .select("amount_cents, status")
      .eq("reservation_id", reservationId),
  ]);
  if (rErr) throw rErr;
  if (pErr) throw pErr;

  const total_cents = (r as { total_cents: number } | null)?.total_cents || 0;
  const payments = (paymentsData as Array<{ amount_cents: number; status: string }>) || [];

  const refundedTotal = payments
    .filter((p) => p.status === "refunded")
    .reduce((s, p) => s + p.amount_cents, 0);
  const paidTotal = payments
    .filter((p) => p.status === "completed")
    .reduce((s, p) => s + p.amount_cents, 0);

  let status: "unpaid" | "partially_paid" | "paid" | "refunded";
  if (refundedTotal > 0 && paidTotal === 0) status = "refunded";
  else if (paidTotal === 0) status = "unpaid";
  else if (paidTotal >= total_cents) status = "paid";
  else status = "partially_paid";

  return { paid_cents: paidTotal, total_cents, status };
}

export async function syncReservationPaymentStatus(reservationId: string) {
  const { status } = await computePaymentStatusForReservation(reservationId);
  const supabase = createAdminClient();
  const { error } = await (supabase.from("reservations") as any) // eslint-disable-line @typescript-eslint/no-explicit-any
    .update({ payment_status: status })
    .eq("id", reservationId);
  if (error) throw error;
  return { status };
}
