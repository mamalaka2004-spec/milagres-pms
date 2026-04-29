import { z } from "zod";

export const ownerSchema = z.object({
  full_name: z.string().min(2, "Name required").max(200),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  phone: z.string().optional(),
  document_number: z.string().optional(),
  document_type: z.enum(["cpf", "cnpj", "passport", "other"]).optional(),
  notes: z.string().max(1000).optional(),
  is_active: z.boolean().default(true),
});

export type OwnerInput = z.infer<typeof ownerSchema>;
