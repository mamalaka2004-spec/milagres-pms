import { createAdminClient } from "@/lib/supabase/admin";
import type { ChecklistItem, TaskPhotoKind, TaskMediaType } from "@/types/database";
import { shiftDateTime, type AutomationSettings } from "@/lib/validations/operations";
import { getAutomationSettings } from "@/lib/db/queries/settings";
import { resolveChecklistForTask } from "@/lib/db/queries/checklists";

export type TaskType =
  | "checkout_clean"
  | "checkin_prep"
  | "deep_clean"
  | "inspection"
  | "turnover";

export type TaskStatus = "pending" | "in_progress" | "completed" | "skipped";
export type Priority = "low" | "normal" | "high" | "urgent";

export interface TaskRow {
  id: string;
  company_id: string;
  property_id: string;
  reservation_id: string | null;
  type: TaskType;
  status: TaskStatus;
  priority: Priority;
  assigned_to: string | null;
  due_date: string | null;
  due_time: string | null;
  notes: string | null;
  completed_at: string | null;
  completed_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface TaskWithJoins extends TaskRow {
  property: { id: string; name: string; code: string } | null;
  reservation: { id: string; booking_code: string; guest: { full_name: string } | null } | null;
  assignee: { id: string; full_name: string; avatar_url: string | null } | null;
}

export interface TaskPhoto {
  id: string;
  kind: TaskPhotoKind;
  url: string;
  media_type: TaskMediaType;
  created_at: string;
  uploaded_by: string | null;
}

export interface TaskDetail extends TaskWithJoins {
  started_at: string | null;
  checklist: ChecklistItem[];
  photos: TaskPhoto[];
}

export interface TaskFilters {
  status?: TaskStatus | "all";
  property_id?: string;
  assigned_to?: string;
  type?: TaskType;
  /** YYYY-MM-DD inclusive */
  from?: string;
  to?: string;
  /** Convenience: due on/before given date AND not completed */
  overdue_before?: string;
  /** Field-worker view: tasks assigned to this user OR unassigned (up for grabs). */
  assigned_or_unassigned?: string;
}

const TASK_LIST_SELECT = `
  id, company_id, property_id, reservation_id, type, status, priority,
  assigned_to, due_date, due_time, notes, completed_at, completed_by, created_at, updated_at,
  property:properties (id, name, code),
  reservation:reservations (id, booking_code, guest:guests (full_name)),
  assignee:users!housekeeping_tasks_assigned_to_fkey (id, full_name, avatar_url)
`;

export async function listTasks(
  companyId: string,
  filters: TaskFilters = {}
): Promise<TaskWithJoins[]> {
  const supabase = createAdminClient();
  let query = supabase
    .from("housekeeping_tasks")
    .select(TASK_LIST_SELECT)
    .eq("company_id", companyId)
    .order("due_date", { ascending: true, nullsFirst: false })
    .order("priority", { ascending: false });

  if (filters.status && filters.status !== "all") {
    query = query.eq("status", filters.status);
  }
  if (filters.property_id) query = query.eq("property_id", filters.property_id);
  if (filters.assigned_to) query = query.eq("assigned_to", filters.assigned_to);
  if (filters.assigned_or_unassigned) {
    query = query.or(`assigned_to.eq.${filters.assigned_or_unassigned},assigned_to.is.null`);
  }
  if (filters.type) query = query.eq("type", filters.type);
  if (filters.from) query = query.gte("due_date", filters.from);
  if (filters.to) query = query.lte("due_date", filters.to);
  if (filters.overdue_before) {
    query = query.lt("due_date", filters.overdue_before).neq("status", "completed").neq("status", "skipped");
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data as unknown as TaskWithJoins[]) || [];
}

export interface CreateTaskInput {
  company_id: string;
  property_id: string;
  reservation_id?: string | null;
  type: TaskType;
  priority?: Priority;
  status?: TaskStatus;
  assigned_to?: string | null;
  due_date?: string | null;
  due_time?: string | null;
  notes?: string | null;
  checklist?: ChecklistItem[];
}

export async function createTask(input: CreateTaskInput): Promise<TaskRow> {
  const supabase = createAdminClient();
  const { data, error } = await (supabase.from("housekeeping_tasks") as any) // eslint-disable-line @typescript-eslint/no-explicit-any
    .insert({
      ...input,
      priority: input.priority ?? "normal",
      status: input.status ?? "pending",
    })
    .select()
    .single();
  if (error) throw error;
  return data as TaskRow;
}

export async function updateTask(
  id: string,
  patch: Partial<CreateTaskInput> & { completed_at?: string | null; completed_by?: string | null }
): Promise<TaskRow> {
  const supabase = createAdminClient();
  const { data, error } = await (supabase.from("housekeeping_tasks") as any) // eslint-disable-line @typescript-eslint/no-explicit-any
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as TaskRow;
}

// Hard delete — the housekeeping_tasks table has no deleted_at column.
export async function deleteTask(id: string) {
  const supabase = createAdminClient();
  const { error } = await supabase.from("housekeeping_tasks").delete().eq("id", id);
  if (error) throw error;
  return { success: true };
}

export async function getTaskById(id: string): Promise<TaskWithJoins | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("housekeeping_tasks")
    .select(TASK_LIST_SELECT)
    .eq("id", id)
    .single();
  if (error) {
    if ((error as { code?: string }).code === "PGRST116") return null;
    throw error;
  }
  return data as unknown as TaskWithJoins;
}

const TASK_DETAIL_SELECT = `${TASK_LIST_SELECT},
  started_at, checklist,
  photos:task_photos (id, kind, url, media_type, created_at, uploaded_by)
`;

/** Single task with checklist + photos for the field-worker detail view. */
export async function getTaskDetail(id: string): Promise<TaskDetail | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("housekeeping_tasks")
    .select(TASK_DETAIL_SELECT)
    .eq("id", id)
    .single();
  if (error) {
    if ((error as { code?: string }).code === "PGRST116") return null;
    throw error;
  }
  const t = data as unknown as TaskDetail;
  // newest photos first
  t.photos = (t.photos || []).slice().sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  return t;
}

// ─── Auto-agendamento (Fase 6): limpeza pós-checkout + preparo pré-check-in ───

export interface AutomationReservation {
  id: string;
  company_id: string;
  property_id: string;
  check_in_date: string;
  check_out_date: string;
  property: { check_in_time?: string | null; check_out_time?: string | null } | null;
}

type AutoTaskType = "checkout_clean" | "checkin_prep";

/** Prazo calculado pela config da empresa (offset em horas sobre o horário do imóvel). */
function autoTaskDue(
  reservation: AutomationReservation,
  type: AutoTaskType,
  settings: AutomationSettings
): { due_date: string; due_time: string } {
  if (type === "checkout_clean") {
    const base = reservation.property?.check_out_time?.slice(0, 5) || "11:00";
    return shiftDateTime(reservation.check_out_date, base, settings.checkout_offset_hours);
  }
  const base = reservation.property?.check_in_time?.slice(0, 5) || "15:00";
  return shiftDateTime(reservation.check_in_date, base, -settings.checkin_offset_hours);
}

/**
 * Auto-create a housekeeping task (checkout_clean | checkin_prep) for a reservation.
 * Idempotent (one task per reservation+type); respects the company automation settings;
 * seeds the checklist from the active template for the property/type.
 */
export async function ensureReservationTask(
  reservation: AutomationReservation,
  type: AutoTaskType,
  presetSettings?: AutomationSettings
): Promise<TaskRow | { skipped: "exists" | "disabled" }> {
  const settings = presetSettings ?? (await getAutomationSettings(reservation.company_id));
  const enabled = type === "checkout_clean" ? settings.checkout_clean_enabled : settings.checkin_prep_enabled;
  if (!enabled) return { skipped: "disabled" };

  const supabase = createAdminClient();
  const { data: existing } = await supabase
    .from("housekeeping_tasks")
    .select("id")
    .eq("reservation_id", reservation.id)
    .eq("type", type)
    .limit(1);
  if (existing && existing.length > 0) return { skipped: "exists" };

  const { due_date, due_time } = autoTaskDue(reservation, type, settings);
  const checklist =
    (await resolveChecklistForTask(reservation.company_id, type, reservation.property_id)) ?? [];

  return createTask({
    company_id: reservation.company_id,
    property_id: reservation.property_id,
    reservation_id: reservation.id,
    type,
    priority: "high",
    status: "pending",
    due_date,
    due_time,
    checklist,
    notes:
      type === "checkout_clean"
        ? "Auto-agendada (pós-checkout). Revise antes do próximo hóspede."
        : "Auto-agendada (pré-check-in). Deixe a unidade pronta para o hóspede.",
  });
}

/** Reagenda tarefas automáticas PENDENTES quando as datas da reserva mudam. */
export async function rescheduleReservationTasks(reservation: AutomationReservation): Promise<void> {
  const settings = await getAutomationSettings(reservation.company_id);
  const supabase = createAdminClient();
  for (const type of ["checkout_clean", "checkin_prep"] as const) {
    const { due_date, due_time } = autoTaskDue(reservation, type, settings);
    await (supabase.from("housekeeping_tasks") as any) // eslint-disable-line @typescript-eslint/no-explicit-any
      .update({ due_date, due_time })
      .eq("reservation_id", reservation.id)
      .eq("type", type)
      .eq("status", "pending");
  }
}

/** Remove tarefas automáticas pendentes de uma reserva cancelada. */
export async function cancelPendingReservationTasks(reservationId: string): Promise<void> {
  const supabase = createAdminClient();
  await supabase
    .from("housekeeping_tasks")
    .delete()
    .eq("reservation_id", reservationId)
    .eq("status", "pending")
    .in("type", ["checkout_clean", "checkin_prep"]);
}
