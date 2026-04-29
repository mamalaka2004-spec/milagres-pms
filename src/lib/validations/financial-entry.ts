import { z } from "zod";

export const ENTRY_TYPES = [
  "revenue",
  "expense",
  "commission",
  "payout",
  "tax",
  "refund",
] as const;

export const financialEntrySchema = z.object({
  type: z.enum(ENTRY_TYPES),
  category: z.string().max(80).optional(),
  description: z.string().max(500).optional(),
  amount: z.coerce.number().min(0, "Amount must be positive"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD"),
  reservation_id: z.string().uuid().optional(),
  property_id: z.string().uuid().optional(),
});
export type FinancialEntryInput = z.infer<typeof financialEntrySchema>;

export const financialEntryUpdateSchema = financialEntrySchema.partial();
export type FinancialEntryUpdateInput = z.infer<typeof financialEntryUpdateSchema>;
