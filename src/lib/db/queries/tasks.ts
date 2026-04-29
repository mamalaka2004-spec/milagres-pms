import { createAdminClient } from "@/lib/supabase/admin";

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

/**
 * Auto-create a checkout_clean task for a reservation.
 * Idempotent: checks for existing task for the reservation+type before creating.
 */
export async function ensureCheckoutCleaningTask(reservation: {
  id: string;
  company_id: string;
  property_id: string;
  check_out_date: string;
  property: { check_out_time?: string | null } | null;
}): Promise<TaskRow | { skipped: "exists" }> {
  const supabase = createAdminClient();
  const { data: existing } = await supabase
    .from("housekeeping_tasks")
    .select("id")
    .eq("reservation_id", reservation.id)
    .eq("type", "checkout_clean")
    .limit(1);
  if (existing && existing.length > 0) return { skipped: "exists" };

  return createTask({
    company_id: reservation.company_id,
    property_id: reservation.property_id,
    reservation_id: reservation.id,
    type: "checkout_clean",
    priority: "high",
    status: "pending",
    due_date: reservation.check_out_date,
    due_time: reservation.property?.check_out_time
      ? reservation.property.check_out_time.slice(0, 5)
      : "11:00",
    notes: "Auto-criada no check-out. Revise antes do próximo hóspede.",
  });
}
