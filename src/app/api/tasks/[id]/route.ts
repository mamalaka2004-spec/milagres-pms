import { NextRequest } from "next/server";
import { taskUpdateSchema } from "@/lib/validations/task";
import { getTaskById, updateTask } from "@/lib/db/queries/tasks";
import { requireRole } from "@/lib/auth";
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

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireRole(["admin", "manager", "staff"]);
    const { id } = await params;

    const existing = await getTaskById(id);
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

    // Auto-stamp completed metadata when status flips to completed
    if (patch.status === "completed" && existing.status !== "completed") {
      patch.completed_at = new Date().toISOString();
      patch.completed_by = user.id;
    }
    if (patch.status && patch.status !== "completed" && existing.status === "completed") {
      patch.completed_at = null;
      patch.completed_by = null;
    }

    const task = await updateTask(id, patch);
    return apiSuccess(task);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    if (error instanceof Error && error.message === "Forbidden") return apiForbidden();
    return apiServerError(error);
  }
}
