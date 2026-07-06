import { NextRequest } from "next/server";
import { taskUpdateSchema } from "@/lib/validations/task";
import { getTaskById, getTaskDetail, updateTask, deleteTask } from "@/lib/db/queries/tasks";
import { requireAuth, requireRole } from "@/lib/auth";
import { logActivity } from "@/lib/audit/log";
import {
  apiSuccess,
  apiError,
  apiUnauthorized,
  apiForbidden,
  apiNotFound,
  apiServerError,
} from "@/lib/api/response";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// ─── GET /api/tasks/[id] ─── single task with checklist + photos (worker detail view)
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth();
    const { id } = await params;
    const task = await getTaskDetail(id);
    if (!task) return apiNotFound("Task");
    if (task.company_id !== user.company_id) return apiForbidden();
    return apiSuccess(task);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    if (error instanceof Error && error.message === "Forbidden") return apiForbidden();
    return apiServerError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireRole(["admin", "manager", "staff", "camareira"]);
    const { id } = await params;

    const existing = await getTaskDetail(id);
    if (!existing) return apiNotFound("Task");
    if (existing.company_id !== user.company_id) return apiForbidden();

    const body = await request.json();
    const validation = taskUpdateSchema.safeParse(body);
    if (!validation.success) {
      return apiError("Validation failed", 400, validation.error.flatten());
    }
    const data = validation.data;
    const patch: Record<string, unknown> = {};
    for (const k of [
      "type",
      "priority",
      "status",
      "due_date",
      "due_time",
      "notes",
      "assigned_to",
    ] as const) {
      if (data[k] !== undefined) patch[k] = data[k] === "" ? null : data[k];
    }
    if (data.checklist !== undefined) patch.checklist = data.checklist;

    // Service check-in: stamp started_at the first time work begins.
    if (patch.status === "in_progress" && !existing.started_at) {
      patch.started_at = new Date().toISOString();
    }

    // Auto-stamp completed metadata when status flips to completed
    if (patch.status === "completed" && existing.status !== "completed") {
      patch.completed_at = new Date().toISOString();
      patch.completed_by = user.id;
      if (!existing.started_at) patch.started_at = new Date().toISOString();
    }
    if (patch.status && patch.status !== "completed" && existing.status === "completed") {
      patch.completed_at = null;
      patch.completed_by = null;
    }

    const task = await updateTask(id, patch);
    await logActivity({
      user,
      action: "task.update",
      entityType: "task",
      entityId: id,
      details: { type: existing.type, ...(patch.status ? { to: patch.status } : {}) },
    });
    return apiSuccess(task);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    if (error instanceof Error && error.message === "Forbidden") return apiForbidden();
    return apiServerError(error);
  }
}

// ─── DELETE /api/tasks/[id] ───
// Hard delete: the housekeeping_tasks table has no deleted_at column.
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireRole(["admin", "manager", "staff"]);
    const { id } = await params;

    const existing = await getTaskById(id);
    if (!existing) return apiNotFound("Task");
    if (existing.company_id !== user.company_id) return apiForbidden();

    await deleteTask(id);
    await logActivity({ user, action: "task.delete", entityType: "task", entityId: id, details: { type: existing.type } });
    return apiSuccess({ deleted: true });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    if (error instanceof Error && error.message === "Forbidden") return apiForbidden();
    return apiServerError(error);
  }
}
