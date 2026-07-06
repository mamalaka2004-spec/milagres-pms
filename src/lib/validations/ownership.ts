import { z } from "zod";

// Validation for the property_ownership link (#11 — proprietário ↔ imóvel).
// Percentages are DECIMAL(5,2) in the DB: share must be > 0 and ≤ 100,
// commission is 0–100. `coerce` accepts number inputs coming from the UI.

export const ownershipCreateSchema = z.object({
  property_id: z.string().uuid("Imóvel inválido"),
  owner_id: z.string().uuid("Proprietário inválido"),
  share_percentage: z.coerce
    .number()
    .gt(0, "A participação deve ser maior que 0%")
    .max(100, "Máximo 100%"),
  commission_percentage: z.coerce.number().min(0).max(100, "Máximo 100%").default(0),
});

export const ownershipUpdateSchema = z
  .object({
    share_percentage: z.coerce.number().gt(0, "A participação deve ser maior que 0%").max(100, "Máximo 100%").optional(),
    commission_percentage: z.coerce.number().min(0).max(100, "Máximo 100%").optional(),
    is_active: z.boolean().optional(),
  })
  .refine((d) => Object.keys(d).length > 0, "Nenhum campo para atualizar");

export type OwnershipCreateInput = z.infer<typeof ownershipCreateSchema>;
export type OwnershipUpdateInput = z.infer<typeof ownershipUpdateSchema>;
