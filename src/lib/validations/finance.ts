import { z } from "zod";

// ===========================================================================
// Financeiro — validações (Fase 5, migration 027)
// Valores monetários chegam em R$ nos forms; as rotas convertem para cents.
// ===========================================================================

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");

// ─── Contas bancárias ────────────────────────────────────────────────────────
export const bankAccountSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório").max(80),
  type: z.enum(["corrente", "poupanca", "investimento", "caixa"]).default("corrente"),
  opening_balance: z.coerce.number().default(0),
  opening_balance_date: dateStr.optional().nullable(),
  is_active: z.boolean().default(true),
});
export type BankAccountInput = z.infer<typeof bankAccountSchema>;

export const bankAccountUpdateSchema = bankAccountSchema.partial();
export type BankAccountUpdateInput = z.infer<typeof bankAccountUpdateSchema>;

// ─── Centros de custo ────────────────────────────────────────────────────────
export const costCenterSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório").max(80),
  description: z.string().max(500).optional().nullable(),
  is_active: z.boolean().default(true),
});
export type CostCenterInput = z.infer<typeof costCenterSchema>;

export const costCenterUpdateSchema = costCenterSchema.partial();
export type CostCenterUpdateInput = z.infer<typeof costCenterUpdateSchema>;

// ─── Categorias ──────────────────────────────────────────────────────────────
export const finCategorySchema = z.object({
  type: z.enum(["revenue", "expense"]),
  name: z.string().min(1, "Nome é obrigatório").max(80),
  parent_id: z.string().uuid().optional().nullable(),
  sort_order: z.coerce.number().int().min(0).max(10000).default(0),
  is_active: z.boolean().default(true),
});
export type FinCategoryInput = z.infer<typeof finCategorySchema>;

export const finCategoryUpdateSchema = finCategorySchema.partial();
export type FinCategoryUpdateInput = z.infer<typeof finCategoryUpdateSchema>;

// ─── Transações ──────────────────────────────────────────────────────────────
const transactionBase = z.object({
  type: z.enum(["revenue", "expense"]),
  status: z.enum(["pending", "paid", "canceled"]).default("pending"),
  date_ref: dateStr,
  date_due: dateStr.optional().nullable(),
  date_paid: dateStr.optional().nullable(),
  amount: z.coerce.number().gt(0, "Valor deve ser maior que zero"),
  description: z.string().min(1, "Descrição é obrigatória").max(300),
  counterparty: z.string().max(160).optional().nullable(),
  category_id: z.string().uuid().optional().nullable(),
  cost_center_id: z.string().uuid().optional().nullable(),
  bank_account_id: z.string().uuid().optional().nullable(),
  payment_method: z
    .enum(["pix", "credit_card", "debit_card", "bank_transfer", "boleto", "cash", "other"])
    .optional()
    .nullable(),
  recurrence: z
    .enum(["none", "weekly", "biweekly", "monthly", "quarterly", "semiannual", "yearly"])
    .default("none"),
  property_id: z.string().uuid().optional().nullable(),
  reservation_id: z.string().uuid().optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

export const finTransactionSchema = transactionBase;
export type FinTransactionInput = z.infer<typeof finTransactionSchema>;

export const finTransactionUpdateSchema = transactionBase.partial();
export type FinTransactionUpdateInput = z.infer<typeof finTransactionUpdateSchema>;

/** amount (R$) → amount_cents e coerência status × date_paid (usado nas rotas). */
export function toTransactionRow(data: Partial<FinTransactionInput>) {
  const { amount, ...rest } = data;
  const row: Record<string, unknown> = { ...rest };
  if (amount !== undefined) row.amount_cents = Math.round(amount * 100);
  if (data.status === "paid" && !data.date_paid) {
    row.date_paid = new Date().toISOString().slice(0, 10);
  }
  if (data.status && data.status !== "paid") row.date_paid = null;
  return row;
}

// ─── Transferências ──────────────────────────────────────────────────────────
export const finTransferSchema = z
  .object({
    from_account_id: z.string().uuid({ message: "Selecione a conta de origem" }),
    to_account_id: z.string().uuid({ message: "Selecione a conta de destino" }),
    amount: z.coerce.number().gt(0, "Valor deve ser maior que zero"),
    date: dateStr,
    description: z.string().max(300).optional().default(""),
  })
  .refine((d) => d.from_account_id !== d.to_account_id, {
    path: ["to_account_id"],
    message: "Origem e destino devem ser contas diferentes",
  });
export type FinTransferInput = z.infer<typeof finTransferSchema>;
