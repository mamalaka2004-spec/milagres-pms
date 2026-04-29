import { z } from "zod";

export const PAYMENT_METHODS = [
  "pix",
  "credit_card",
  "debit_card",
  "bank_transfer",
  "cash",
  "platform",
  "other",
] as const;

export const PAYMENT_STATUS_VALUES = ["pending", "completed", "failed", "refunded"] as const;

export const paymentSchema = z.object({
  reservation_id: z.string().uuid(),
  amount: z.coerce.number().positive("Amount must be greater than zero"),
  method: z.enum(PAYMENT_METHODS),
  status: z.enum(PAYMENT_STATUS_VALUES).default("completed"),
  reference: z.string().max(100).optional(),
  paid_at: z.string().optional(), // ISO datetime
  notes: z.string().max(500).optional(),
});
export type PaymentInput = z.infer<typeof paymentSchema>;

export const paymentUpdateSchema = paymentSchema.partial();
export type PaymentUpdateInput = z.infer<typeof paymentUpdateSchema>;
