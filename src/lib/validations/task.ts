import { z } from "zod";

export const TASK_TYPES = [
  "checkout_clean",
  "checkin_prep",
  "deep_clean",
  "inspection",
  "turnover",
] as const;

export const TASK_STATUSES = [
  "pending",
  "in_progress",
  "completed",
  "skipped",
] as const;

export const PRIORITIES = ["low", "normal", "high", "urgent"] as const;

export const taskSchema = z.object({
  property_id: z.string().uuid(),
  reservation_id: z.string().uuid().optional(),
  type: z.enum(TASK_TYPES).default("checkout_clean"),
  priority: z.enum(PRIORITIES).default("normal"),
  status: z.enum(TASK_STATUSES).default("pending"),
  assigned_to: z.string().uuid().optional().or(z.literal("")),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD").optional().or(z.literal("")),
  due_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, "Use HH:MM").optional().or(z.literal("")),
  notes: z.string().max(1000).optional(),
});
export type TaskInput = z.infer<typeof taskSchema>;

export const checklistItemSchema = z.object({
  id: z.string().max(40),
  label: z.string().min(1).max(120),
  done: z.boolean(),
});

export const taskUpdateSchema = taskSchema.partial().extend({
  checklist: z.array(checklistItemSchema).max(60).optional(),
});
export type TaskUpdateInput = z.infer<typeof taskUpdateSchema>;

export const TASK_TYPE_LABELS: Record<(typeof TASK_TYPES)[number], string> = {
  checkout_clean: "Limpeza de saída",
  checkin_prep: "Preparo de entrada",
  deep_clean: "Limpeza pesada",
  inspection: "Inspeção",
  turnover: "Virada (turnover)",
};

/** Default checklist suggested when a worker starts a task, by type. */
export const DEFAULT_CHECKLISTS: Record<(typeof TASK_TYPES)[number], string[]> = {
  checkout_clean: ["Quarto(s)", "Banheiro(s)", "Cozinha", "Roupa de cama trocada", "Toalhas trocadas", "Lixo recolhido", "Amenities repostos", "Piso/varanda"],
  checkin_prep: ["Conferir limpeza", "Roupa de cama", "Toalhas", "Amenities", "Água/cortesia", "Ar/iluminação ok", "Chaves/acesso"],
  deep_clean: ["Geladeira/fogão", "Janelas e vidros", "Armários por dentro", "Rejunte/box", "Atrás dos móveis", "Ventiladores/ar"],
  inspection: ["Itens danificados", "Estoque de amenities", "Funcionamento elétrico", "Hidráulica/vazamentos", "Fotos de pendências"],
  turnover: ["Limpeza completa", "Roupa de cama e banho", "Reposição de itens", "Inspeção final", "Pronto para check-in"],
};
