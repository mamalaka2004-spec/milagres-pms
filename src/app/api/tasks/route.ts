import { NextRequest } from "next/server";
import { taskSchema, TASK_TYPES, TASK_STATUSES } from "@/lib/validations/task";
import { listTasks, createTask, type TaskFilters, type TaskStatus, type TaskType } from "@/lib/db/queries/tasks";
import { requireAuth, requireRole } from "@/lib/auth";
import {
  apiSuccess,
  apiError,
  apiUnauthorized,
  apiForbidden,
  apiServerError,
} from "@/lib/api/response";

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const { searchParams } = new URL(request.url);
    const filters: TaskFilters = {};
    const status = searchParams.get("status");
    if (status && (TASK_STATUSES as readonly string[]).includes(status)) {
      filters.status = status as TaskStatus;
    } else if (status === "all") {
      filters.status = "all";
    }
    const type = searchParams.get("type");
    if (type && (TASK_TYPES as readonly string[]).includes(type)) {
      filters.type = type as TaskType;
    }
    if (searchParams.get("property_id")) filters.property_id = searchParams.get("property_id")!;
    if (searchParams.get("assigned_to")) filters.assigned_to = searchParams.get("assigned_to")!;
    if (searchParams.get("from")) filters.from = searchParams.get("from")!;
    if (searchParams.get("to")) filters.to = searchParams.get("to")!;
    if (searchParams.get("overdue_before")) filters.overdue_before = searchParams.get("overdue_before")!;

    const tasks = await listTasks(user.company_id, filters);
    return apiSuccess(tasks);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    return apiServerError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireRole(["admin", "manager", "staff"]);
    const body = await request.json();
    const validation = taskSchema.safeParse(body);
    if (!validation.success) {
      return apiError("Validation failed", 400, validation.error.flatten());
    }
    const data = validation.data;
    const task = await createTask({
      company_id: user.company_id,
      property_id: data.property_id,
      reservation_id: data.reservation_id || null,
      type: data.type,
      priority: data.priority,
      status: data.status,
      assigned_to: data.assigned_to || null,
      due_date: data.due_date || null,
      due_time: data.due_time || null,
      notes: data.notes || null,
    });
    return apiSuccess(task, 201);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    if (error instanceof Error && error.message === "Forbidden") return apiForbidden();
    return apiServerError(error);
  }
}
