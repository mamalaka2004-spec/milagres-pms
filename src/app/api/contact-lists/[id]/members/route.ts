import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import { logActivity } from "@/lib/audit/log";
import { apiSuccess, apiError, apiUnauthorized, apiForbidden, apiNotFound, apiServerError } from "@/lib/api/response";
import { getContactList, addMembers, removeMembers } from "@/lib/db/queries/contact-lists";
import { contactListMembersSchema } from "@/lib/validations/campaign";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const user = await requireRole(["admin", "manager"]);
    const { id } = await params;
    const parsed = contactListMembersSchema.safeParse(await req.json());
    if (!parsed.success) return apiError("Dados inválidos", 400, parsed.error.flatten());
    const list = await getContactList(id, user.company_id);
    if (!list) return apiNotFound("Lista não encontrada");
    const memberCount = await addMembers(id, parsed.data.contact_ids);
    await logActivity({ user, action: "contact_list.add_members", entityType: "contact_list", entityId: id, details: { label: list.name, added: parsed.data.contact_ids.length } });
    return apiSuccess({ member_count: memberCount });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    if (error instanceof Error && error.message === "Forbidden") return apiForbidden();
    return apiServerError(error);
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const user = await requireRole(["admin", "manager"]);
    const { id } = await params;
    const parsed = contactListMembersSchema.safeParse(await req.json());
    if (!parsed.success) return apiError("Dados inválidos", 400, parsed.error.flatten());
    const list = await getContactList(id, user.company_id);
    if (!list) return apiNotFound("Lista não encontrada");
    const memberCount = await removeMembers(id, parsed.data.contact_ids);
    await logActivity({ user, action: "contact_list.remove_members", entityType: "contact_list", entityId: id, details: { label: list.name, removed: parsed.data.contact_ids.length } });
    return apiSuccess({ member_count: memberCount });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    if (error instanceof Error && error.message === "Forbidden") return apiForbidden();
    return apiServerError(error);
  }
}
