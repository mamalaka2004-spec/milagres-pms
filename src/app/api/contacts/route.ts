import { NextRequest } from "next/server";
import { requireFullAccess, requireRole } from "@/lib/auth";
import { logActivity } from "@/lib/audit/log";
import { apiSuccess, apiError, apiUnauthorized, apiForbidden, apiServerError } from "@/lib/api/response";
import { searchContacts, listContactsPaged, listContactIds, createContact } from "@/lib/db/queries/contacts";
import { contactCreateSchema } from "@/lib/validations/contact";

export async function GET(req: NextRequest) {
  try {
    const user = await requireFullAccess();
    const sp = req.nextUrl.searchParams;
    const filters = {
      q: sp.get("q") || undefined,
      category: sp.get("category") || undefined,
      lineId: sp.get("line_id") || undefined,
      tag: sp.get("tag") || undefined,
      minRating: sp.get("min_rating") ? Number(sp.get("min_rating")) : undefined,
      doNotContact:
        sp.get("dnc") === "1" ? true : sp.get("dnc") === "0" ? false : undefined,
      nameStatus: (sp.get("name_status") as "pendente" | "sem_nome" | "ok" | null) ?? undefined,
      limit: sp.get("limit") ? Math.min(200, Number(sp.get("limit"))) : 50,
      offset: sp.get("offset") ? Number(sp.get("offset")) : 0,
    };
    // ids=1 → só os IDs do filtro (seleção "todos"); paged=1 → { contacts, total };
    // sem nada → array (pickers legados).
    if (sp.get("ids") === "1") {
      return apiSuccess({ ids: await listContactIds(user.company_id, filters) });
    }
    if (sp.get("paged") === "1") {
      return apiSuccess(await listContactsPaged(user.company_id, filters));
    }
    return apiSuccess(await searchContacts(user.company_id, filters));
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    if (error instanceof Error && error.message === "Forbidden") return apiForbidden();
    return apiSuccess([]);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireRole(["admin", "manager"]);
    const parsed = contactCreateSchema.safeParse(await req.json());
    if (!parsed.success) return apiError("Dados inválidos", 400, parsed.error.flatten());
    const contact = await createContact(user.company_id, parsed.data);
    await logActivity({ user, action: "contact.create", entityType: "whatsapp_contact", entityId: contact.id, details: { label: contact.display_name || contact.phone_e164 } });
    return apiSuccess(contact);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    if (error instanceof Error && error.message === "Forbidden") return apiForbidden();
    if (error instanceof Error && /Já existe|Telefone inválido/.test(error.message)) {
      return apiError(error.message, 409);
    }
    return apiServerError(error);
  }
}
