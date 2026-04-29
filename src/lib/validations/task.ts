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

export const taskUpdateSchema = taskSchema.partial();
export type TaskUpdateInput = z.infer<typeof taskUpdateSchema>;

export const TASK_TYPE_LABELS: Record<(typeof TASK_TYPES)[number], string> = {
  checkout_clean: "Checkout clean",
  checkin_prep: "Check-in prep",
  deep_clean: "Deep clean",
  inspection: "Inspection",
  turnover: "Turnover",
};
