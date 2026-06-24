import { NextRequest } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncReservationPaymentStatus, computePaymentStatusForReservation } from "@/lib/db/queries/payments";
import * as asaas from "@/lib/asaas/client";
import {
  apiSuccess,
  apiError,
  apiUnauthorized,
  apiForbidden,
  apiNotFound,
  apiServerError,
} from "@/lib/api/response";

interface Params { params: Promise<{ id: string }> }

const bodySchema = z.object({
  billing_type: z.enum(["PIX", "BOLETO", "CREDIT_CARD", "UNDEFINED"]).default("PIX"),
  amount: z.number().positive().optional(), // reais; default = saldo em aberto
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

function plusDays(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const METHOD_FOR: Record<string, string> = { PIX: "pix", CREDIT_CARD: "credit_card", BOLETO: "other", UNDEFINED: "other" };

/** Generate an Asaas charge for a reservation's outstanding balance and persist it as a pending payment. */
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const user = await requireRole(["admin", "manager"]);
    const { id } = await params;

    if (!asaas.isConfigured()) {
      return apiError("Asaas não está configurado. Defina ASAAS_API_KEY para gerar cobranças.", 400);
    }

    const v = bodySchema.safeParse(await request.json().catch(() => ({})));
    if (!v.success) return apiError("Validação falhou", 400, v.error.flatten());

    const supabase = createAdminClient();
    const { data: rRaw } = await supabase
      .from("reservations")
      .select("id, company_id, booking_code, total_cents, guest:guests (id, full_name, email, phone, document_number, asaas_customer_id)")
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle();
    const r = rRaw as unknown as {
      id: string; company_id: string; booking_code: string; total_cents: number;
      guest: { id: string; full_name: string; email: string | null; phone: string | null; document_number: string | null; asaas_customer_id: string | null } | null;
    } | null;
    if (!r || r.company_id !== user.company_id) return apiNotFound("Reserva");
    if (!r.guest) return apiError("Reserva sem hóspede vinculado.", 400);

    // Default amount = outstanding balance.
    const { paid_cents } = await computePaymentStatusForReservation(id);
    const balanceCents = Math.max(0, r.total_cents - paid_cents);
    const amountCents = v.data.amount ? Math.round(v.data.amount * 100) : balanceCents;
    if (amountCents <= 0) return apiError("Não há saldo em aberto para cobrar.", 400);

    // 1. Ensure Asaas customer.
    let customerId = r.guest.asaas_customer_id;
    if (!customerId) {
      const customer = await asaas.createCustomer({
        name: r.guest.full_name,
        email: r.guest.email,
        mobilePhone: r.guest.phone,
        cpfCnpj: r.guest.document_number,
        externalReference: r.guest.id,
      });
      customerId = customer.id;
      await (supabase.from("guests") as any).update({ asaas_customer_id: customerId }).eq("id", r.guest.id); // eslint-disable-line @typescript-eslint/no-explicit-any
    }

    // 2. Create the charge.
    const dueDate = v.data.due_date || plusDays(3);
    const charge = await asaas.createPayment({
      customer: customerId,
      billingType: v.data.billing_type,
      value: amountCents / 100,
      dueDate,
      description: `Reserva ${r.booking_code} · Milagres Hospedagens`,
      externalReference: r.id,
    });

    // 3. PIX payload (best-effort).
    let pixPayload: string | null = null;
    if (v.data.billing_type === "PIX") {
      try { pixPayload = (await asaas.getPixQrCode(charge.id)).payload || null; } catch { /* ignore */ }
    }

    // 4. Persist as a pending payment / charge.
    const { data: payment, error: insErr } = await (supabase.from("payments") as any) // eslint-disable-line @typescript-eslint/no-explicit-any
      .insert({
        company_id: r.company_id,
        reservation_id: r.id,
        amount_cents: amountCents,
        method: METHOD_FOR[v.data.billing_type] || "other",
        status: "pending",
        gateway: "asaas",
        external_id: charge.id,
        billing_type: v.data.billing_type,
        invoice_url: charge.invoiceUrl || charge.bankSlipUrl || null,
        pix_payload: pixPayload,
        due_date: dueDate,
        external_status: charge.status,
        synced_at: new Date().toISOString(),
        created_by: user.id,
      })
      .select()
      .single();
    if (insErr) return apiError(`Falha ao salvar cobrança: ${insErr.message}`, 500);

    await syncReservationPaymentStatus(r.id);
    return apiSuccess(payment, 201);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    if (error instanceof Error && error.message === "Forbidden") return apiForbidden();
    return apiServerError(error);
  }
}
