import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import { logActivity } from "@/lib/audit/log";
import { apiSuccess, apiError, apiUnauthorized, apiForbidden, apiNotFound, apiServerError } from "@/lib/api/response";
import { updateGroup, deleteGroup, getGroup } from "@/lib/db/queries/pricing";
import { propertyGroupSchema } from "@/lib/validations/pricing";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireRole(["admin", "manager"]);
    const { id } = await params;
    const parsed = propertyGroupSchema.partial().safeParse(await req.json());
    if (!parsed.success) return apiError("Dados inválidos", 400, parsed.error.flatten());
    const group = await updateGroup(user.company_id, id, parsed.data);
    if (!group) return apiNotFound("Grupo");
    await logActivity({ user, action: "property_group.update", entityType: "property_group", entityId: id, details: { label: group.name } });
    return apiSuccess(group);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    if (error instanceof Error && error.message === "Forbidden") return apiForbidden();
    return apiServerError(error);
  }
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireRole(["admin", "manager"]);
    const { id } = await params;
    const group = await getGroup(user.company_id, id);
    if (!group) return apiNotFound("Grupo");
    await deleteGroup(user.company_id, id);
    await logActivity({ user, action: "property_group.delete", entityType: "property_group", entityId: id, details: { label: group.name } });
    return apiSuccess({ deleted: true });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    if (error instanceof Error && error.message === "Forbidden") return apiForbidden();
    return apiServerError(error);
  }
}
