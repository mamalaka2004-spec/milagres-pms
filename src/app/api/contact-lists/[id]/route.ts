import { NextRequest } from "next/server";
import { requireFullAccess, requireRole } from "@/lib/auth";
import { logActivity } from "@/lib/audit/log";
import { apiSuccess, apiError, apiUnauthorized, apiForbidden, apiNotFound, apiServerError } from "@/lib/api/response";
import {
  getContactList,
  updateContactList,
  deleteContactList,
  listMembers,
} from "@/lib/db/queries/contact-lists";
import { contactListUpdateSchema } from "@/lib/validations/campaign";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const user = await requireFullAccess();
    const { id } = await params;
    const list = await getContactList(id, user.company_id);
    if (!list) return apiNotFound("Lista não encontrada");
    const members = await listMembers(id);
    return apiSuccess({ ...list, member_count: members.length, members });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    if (error instanceof Error && error.message === "Forbidden") return apiForbidden();
    return apiServerError(error);
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const user = await requireRole(["admin", "manager"]);
    const { id } = await params;
    const parsed = contactListUpdateSchema.safeParse(await req.json());
    if (!parsed.success) return apiError("Dados inválidos", 400, parsed.error.flatten());
    const existing = await getContactList(id, user.company_id);
    if (!existing) return apiNotFound("Lista não encontrada");
    const list = await updateContactList(id, user.company_id, parsed.data);
    await logActivity({ user, action: "contact_list.update", entityType: "contact_list", entityId: id, details: { label: list.name } });
    return apiSuccess(list);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    if (error instanceof Error && error.message === "Forbidden") return apiForbidden();
    return apiServerError(error);
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const user = await requireRole(["admin", "manager"]);
    const { id } = await params;
    const existing = await getContactList(id, user.company_id);
    if (!existing) return apiNotFound("Lista não encontrada");
    await deleteContactList(id, user.company_id);
    await logActivity({ user, action: "contact_list.delete", entityType: "contact_list", entityId: id, details: { label: existing.name } });
    return apiSuccess({ deleted: true });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    if (error instanceof Error && error.message === "Forbidden") return apiForbidden();
    return apiServerError(error);
  }
}
