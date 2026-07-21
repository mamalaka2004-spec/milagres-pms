import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import { logActivity } from "@/lib/audit/log";
import { apiSuccess, apiError, apiUnauthorized, apiForbidden, apiServerError } from "@/lib/api/response";
import { setDoNotContact } from "@/lib/db/queries/contact-lists";
import { contactDoNotContactSchema } from "@/lib/validations/campaign";

type Params = { params: Promise<{ id: string }> };

// Opt-out manual (LGPD): contatos marcados nunca entram em campanhas — o
// enqueue filtra do_not_contact e o opt-out por keyword usa o mesmo campo.
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const user = await requireRole(["admin", "manager"]);
    const { id } = await params;
    const parsed = contactDoNotContactSchema.safeParse(await req.json());
    if (!parsed.success) return apiError("Dados inválidos", 400, parsed.error.flatten());
    await setDoNotContact(id, user.company_id, parsed.data.do_not_contact);
    await logActivity({ user, action: "contact.do_not_contact", entityType: "whatsapp_contact", entityId: id, details: { do_not_contact: parsed.data.do_not_contact } });
    return apiSuccess({ do_not_contact: parsed.data.do_not_contact });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    if (error instanceof Error && error.message === "Forbidden") return apiForbidden();
    return apiServerError(error);
  }
}
