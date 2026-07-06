import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import { logActivity } from "@/lib/audit/log";
import { checklistTemplateUpdateSchema } from "@/lib/validations/operations";
import {
  getChecklistTemplateById,
  updateChecklistTemplate,
  deleteChecklistTemplate,
} from "@/lib/db/queries/checklists";
import {
  apiSuccess,
  apiError,
  apiUnauthorized,
  apiForbidden,
  apiNotFound,
  apiServerError,
} from "@/lib/api/response";

interface Params {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const user = await requireRole(["admin", "manager"]);
    const { id } = await params;

    const existing = await getChecklistTemplateById(id);
    if (!existing || existing.company_id !== user.company_id) return apiNotFound("Template");

    const body = await request.json();
    const v = checklistTemplateUpdateSchema.safeParse(body);
    if (!v.success) return apiError("Validation failed", 400, v.error.flatten());

    const template = await updateChecklistTemplate(id, v.data);
    await logActivity({
      user,
      action: "checklist_template.update",
      entityType: "checklist_template",
      entityId: id,
      details: { label: template.name },
    });
    return apiSuccess(template);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    if (error instanceof Error && error.message === "Forbidden") return apiForbidden();
    return apiServerError(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  try {
    const user = await requireRole(["admin", "manager"]);
    const { id } = await params;

    const existing = await getChecklistTemplateById(id);
    if (!existing || existing.company_id !== user.company_id) return apiNotFound("Template");

    await deleteChecklistTemplate(id);
    await logActivity({
      user,
      action: "checklist_template.delete",
      entityType: "checklist_template",
      entityId: id,
      details: { label: existing.name },
    });
    return apiSuccess({ deleted: true });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    if (error instanceof Error && error.message === "Forbidden") return apiForbidden();
    return apiServerError(error);
  }
}
