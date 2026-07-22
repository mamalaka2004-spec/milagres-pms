import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import { logActivity } from "@/lib/audit/log";
import { apiSuccess, apiError, apiUnauthorized, apiForbidden, apiServerError } from "@/lib/api/response";
import { updateContact, deleteContact } from "@/lib/db/queries/contacts";
import { contactUpdateSchema } from "@/lib/validations/contact";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const user = await requireRole(["admin", "manager"]);
    const { id } = await params;
    const parsed = contactUpdateSchema.safeParse(await req.json());
    if (!parsed.success) return apiError("Dados inválidos", 400, parsed.error.flatten());
    const contact = await updateContact(id, user.company_id, parsed.data);
    await logActivity({ user, action: "contact.update", entityType: "whatsapp_contact", entityId: id, details: { label: contact.display_name || contact.phone_e164 } });
    return apiSuccess(contact);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    if (error instanceof Error && error.message === "Forbidden") return apiForbidden();
    if (error instanceof Error && /Telefone inválido/.test(error.message)) return apiError(error.message, 400);
    return apiServerError(error);
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const user = await requireRole(["admin", "manager"]);
    const { id } = await params;
    await deleteContact(id, user.company_id);
    await logActivity({ user, action: "contact.delete", entityType: "whatsapp_contact", entityId: id });
    return apiSuccess({ deleted: true });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    if (error instanceof Error && error.message === "Forbidden") return apiForbidden();
    return apiServerError(error);
  }
}
