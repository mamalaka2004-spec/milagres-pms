import { NextRequest } from "next/server";
import { requireFullAccess, requireRole } from "@/lib/auth";
import { logActivity } from "@/lib/audit/log";
import { apiSuccess, apiError, apiUnauthorized, apiForbidden, apiServerError } from "@/lib/api/response";
import { listContactLists, createContactList } from "@/lib/db/queries/contact-lists";
import { contactListCreateSchema } from "@/lib/validations/campaign";

export async function GET() {
  try {
    const user = await requireFullAccess();
    return apiSuccess(await listContactLists(user.company_id));
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    if (error instanceof Error && error.message === "Forbidden") return apiForbidden();
    return apiSuccess([]);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireRole(["admin", "manager"]);
    const parsed = contactListCreateSchema.safeParse(await req.json());
    if (!parsed.success) return apiError("Dados inválidos", 400, parsed.error.flatten());
    const list = await createContactList(user.company_id, user.id, parsed.data);
    await logActivity({ user, action: "contact_list.create", entityType: "contact_list", entityId: list.id, details: { label: list.name } });
    return apiSuccess(list);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    if (error instanceof Error && error.message === "Forbidden") return apiForbidden();
    return apiServerError(error);
  }
}
