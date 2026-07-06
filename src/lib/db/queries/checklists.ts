import { createAdminClient } from "@/lib/supabase/admin";
import type { ChecklistItem, TaskType } from "@/types/database";
import type { ChecklistTemplateInput } from "@/lib/validations/operations";

export interface ChecklistTemplateRow {
  id: string;
  company_id: string;
  name: string;
  task_type: TaskType;
  items: { id: string; label: string }[];
  property_ids: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const SELECT = "id, company_id, name, task_type, items, property_ids, is_active, created_at, updated_at";

export async function listChecklistTemplates(companyId: string): Promise<ChecklistTemplateRow[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("checklist_templates")
    .select(SELECT)
    .eq("company_id", companyId)
    .order("task_type")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data as unknown as ChecklistTemplateRow[]) || [];
}

export async function getChecklistTemplateById(id: string): Promise<ChecklistTemplateRow | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("checklist_templates")
    .select(SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data as unknown as ChecklistTemplateRow) || null;
}

export async function createChecklistTemplate(
  companyId: string,
  input: ChecklistTemplateInput
): Promise<ChecklistTemplateRow> {
  const supabase = createAdminClient();
  const { data, error } = await (supabase.from("checklist_templates") as any) // eslint-disable-line @typescript-eslint/no-explicit-any
    .insert({ company_id: companyId, ...input })
    .select(SELECT)
    .single();
  if (error) throw error;
  return data as ChecklistTemplateRow;
}

export async function updateChecklistTemplate(
  id: string,
  patch: Partial<ChecklistTemplateInput>
): Promise<ChecklistTemplateRow> {
  const supabase = createAdminClient();
  const { data, error } = await (supabase.from("checklist_templates") as any) // eslint-disable-line @typescript-eslint/no-explicit-any
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select(SELECT)
    .single();
  if (error) throw error;
  return data as ChecklistTemplateRow;
}

export async function deleteChecklistTemplate(id: string): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase.from("checklist_templates").delete().eq("id", id);
  if (error) throw error;
}

/**
 * Resolve o checklist ativo para um contexto (tipo de tarefa × unidade).
 * Template específico da unidade vence o geral; empate = mais recente.
 * Degrada gracioso (null) se a migration 028 ainda não rodou.
 */
export async function resolveChecklistForTask(
  companyId: string,
  taskType: TaskType,
  propertyId: string
): Promise<ChecklistItem[] | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("checklist_templates")
    .select("items, property_ids")
    .eq("company_id", companyId)
    .eq("task_type", taskType)
    .eq("is_active", true)
    .order("updated_at", { ascending: false });
  if (error) return null; // tabela ausente (pré-migration) — cai no default do código
  const rows = (data as unknown as Pick<ChecklistTemplateRow, "items" | "property_ids">[]) || [];
  const specific = rows.find((r) => (r.property_ids || []).includes(propertyId));
  const general = rows.find((r) => !r.property_ids || r.property_ids.length === 0);
  const chosen = specific ?? general;
  if (!chosen || !Array.isArray(chosen.items) || chosen.items.length === 0) return null;
  return chosen.items.map((i) => ({ id: i.id, label: i.label, done: false }));
}
