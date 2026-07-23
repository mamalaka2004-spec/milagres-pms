import { z } from "zod";

/** CRUD do fonebook (página Contatos). */
export const contactCreateSchema = z.object({
  display_name: z.string().min(1, "Nome obrigatório").max(120),
  phone: z.string().min(8, "Telefone inválido").max(20),
  first_name: z.string().max(80).nullable().optional(),
  last_name: z.string().max(120).nullable().optional(),
  social_name: z.string().max(80).nullable().optional(),
  instagram_handle: z.string().max(60).nullable().optional(),
  category: z
    .enum(["guest", "guest_maybe", "lead", "provider", "spam", "personal"])
    .nullable()
    .optional(),
  tags: z.array(z.string().min(1).max(40)).max(20).optional(),
  rating: z.number().int().min(1).max(5).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  do_not_contact: z.boolean().optional(),
});

export const contactUpdateSchema = contactCreateSchema.partial();

export type ContactCreate = z.infer<typeof contactCreateSchema>;
