import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import { logActivity } from "@/lib/audit/log";
import { checklistTemplateSchema } from "@/lib/validations/operations";
import { listChecklistTemplates, createChecklistTemplate } from "@/lib/db/queries/checklists";
import {
  apiSuccess,
  apiError,
  apiUnauthorized,
  apiForbidden,
  apiServerError,
} from "@/lib/api/response";

export async function GET() {
  try {
    const user = await requireRole(["admin", "manager"]);
    const templates = await listChecklistTemplates(user.company_id);
    return apiSuccess(templates);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    if (error instanceof Error && error.message === "Forbidden") return apiForbidden();
    return apiServerError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireRole(["admin", "manager"]);
    const body = await request.json();
    const v = checklistTemplateSchema.safeParse(body);
    if (!v.success) return apiError("Validation failed", 400, v.error.flatten());

    const template = await createChecklistTemplate(user.company_id, v.data);
    await logActivity({
      user,
      action: "checklist_template.create",
      entityType: "checklist_template",
      entityId: template.id,
      details: { label: template.name, task_type: template.task_type },
    });
    return apiSuccess(template, 201);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    if (error instanceof Error && error.message === "Forbidden") return apiForbidden();
    return apiServerError(error);
  }
}
