import { z } from "zod";
import { TASK_TYPES } from "@/lib/validations/task";

// ─── Templates de checklist (Ajustes → Operações) ───

export const checklistTemplateItemSchema = z.object({
  id: z.string().min(1).max(40),
  label: z.string().min(1).max(120),
});

export const checklistTemplateSchema = z.object({
  name: z.string().min(2).max(80),
  task_type: z.enum(TASK_TYPES).default("checkout_clean"),
  items: z.array(checklistTemplateItemSchema).min(1).max(60),
  // Vazio = vale para todas as unidades da empresa.
  property_ids: z.array(z.string().uuid()).max(500).default([]),
  is_active: z.boolean().default(true),
});
export type ChecklistTemplateInput = z.infer<typeof checklistTemplateSchema>;

// PATCH revalida o schema cheio (padrão das pricing rules — CHECKs de consistência).
export const checklistTemplateUpdateSchema = checklistTemplateSchema.partial();
export type ChecklistTemplateUpdateInput = z.infer<typeof checklistTemplateUpdateSchema>;

// ─── Automação de limpeza (auto-agendamento pós-checkout / pré-check-in) ───

export const automationSettingsSchema = z.object({
  checkout_clean_enabled: z.boolean(),
  // Horas DEPOIS do horário de checkout do imóvel.
  checkout_offset_hours: z.number().min(0).max(72),
  checkin_prep_enabled: z.boolean(),
  // Horas ANTES do horário de check-in do imóvel.
  checkin_offset_hours: z.number().min(0).max(72),
});
export type AutomationSettings = z.infer<typeof automationSettingsSchema>;

export const DEFAULT_AUTOMATION: AutomationSettings = {
  checkout_clean_enabled: true,
  checkout_offset_hours: 0, // limpeza na hora do checkout
  checkin_prep_enabled: true,
  checkin_offset_hours: 4, // preparo 4h antes do check-in
};

// ─── Retenção de storage (#14) ───

export const retentionSettingsSchema = z.object({
  enabled: z.boolean(),
  // Remove mídia de tarefas CONCLUÍDAS há mais de N dias.
  days: z.number().int().min(7).max(3650),
});
export type RetentionSettings = z.infer<typeof retentionSettingsSchema>;

export const DEFAULT_RETENTION: RetentionSettings = { enabled: true, days: 90 };

export const operationsSettingsSchema = z.object({
  automation: automationSettingsSchema.optional(),
  retention: retentionSettingsSchema.optional(),
});
export type OperationsSettingsInput = z.infer<typeof operationsSettingsSchema>;

// Chaves na tabela settings (key/value JSONB por empresa).
export const AUTOMATION_SETTING_KEY = "operations.automation";
export const RETENTION_SETTING_KEY = "operations.retention";

// ─── Upload de mídia de tarefas ───

export const TASK_MEDIA_IMAGE_MAX_BYTES = 12 * 1024 * 1024; // 12MB
export const TASK_MEDIA_VIDEO_MAX_BYTES = 100 * 1024 * 1024; // 100MB (limite do bucket)

export const TASK_MEDIA_MIME: Record<string, { ext: string; media_type: "image" | "video" }> = {
  "image/jpeg": { ext: "jpg", media_type: "image" },
  "image/png": { ext: "png", media_type: "image" },
  "image/webp": { ext: "webp", media_type: "image" },
  "video/mp4": { ext: "mp4", media_type: "video" },
  "video/quicktime": { ext: "mov", media_type: "video" },
  "video/webm": { ext: "webm", media_type: "video" },
};

// ─── Agenda: soma horas a uma data+hora locais (sem timezone — datas de negócio) ───

function addDaysISO(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Desloca "date HH:MM" em N horas (pode ser negativo), transbordando entre dias.
 * Usado para calcular o prazo das tarefas auto-agendadas.
 */
export function shiftDateTime(
  date: string,
  time: string,
  offsetHours: number
): { due_date: string; due_time: string } {
  const [h, m] = time.slice(0, 5).split(":").map(Number);
  let minutes = h * 60 + m + Math.round(offsetHours * 60);
  let dueDate = date;
  while (minutes < 0) {
    minutes += 1440;
    dueDate = addDaysISO(dueDate, -1);
  }
  while (minutes >= 1440) {
    minutes -= 1440;
    dueDate = addDaysISO(dueDate, 1);
  }
  const hh = String(Math.floor(minutes / 60)).padStart(2, "0");
  const mm = String(minutes % 60).padStart(2, "0");
  return { due_date: dueDate, due_time: `${hh}:${mm}` };
}
