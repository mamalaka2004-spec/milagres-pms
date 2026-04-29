import { z } from "zod";

export const guestSchema = z.object({
  full_name: z.string().min(2, "Name must be at least 2 characters").max(200),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  phone: z.string().optional(),
  document_number: z.string().optional(),
  document_type: z
    .enum(["cpf", "rg", "passport", "id_card", "other"])
    .optional(),
  date_of_birth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD").optional().or(z.literal("")),
  nationality: z.string().max(100).optional(),
  city: z.string().max(100).optional(),
  state: z.string().max(100).optional(),
  country: z.string().max(2).optional(),
  language: z.string().default("pt-BR"),
  notes: z.string().max(2000).optional(),
  tags: z.array(z.string()).optional(),
  is_vip: z.boolean().default(false),
});

export type GuestInput = z.infer<typeof guestSchema>;

export const guestUpdateSchema = guestSchema.partial();
export type GuestUpdateInput = z.infer<typeof guestUpdateSchema>;
