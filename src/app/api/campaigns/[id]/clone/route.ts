import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import { logActivity } from "@/lib/audit/log";
import { apiSuccess, apiUnauthorized, apiForbidden, apiNotFound, apiServerError } from "@/lib/api/response";
import { getCampaign, cloneCampaign } from "@/lib/db/queries/campaign";

type Params = { params: Promise<{ id: string }> };

/**
 * Duplica a campanha como novo rascunho: copia config antiban, audiência e
 * TODOS os passos da cadência. Destinatários não são copiados — a fila é
 * montada no disparo (a partir das listas/contatos escolhidos).
 */
export async function POST(_req: NextRequest, { params }: Params) {
  try {
    const user = await requireRole(["admin", "manager"]);
    const { id } = await params;
    const original = await getCampaign(id);
    if (!original) return apiNotFound("Campanha");
    if (original.company_id !== user.company_id) return apiForbidden();

    const copy = await cloneCampaign(original, user.id);
    await logActivity({ user, action: "campaign.clone", entityType: "campaign", entityId: copy.id, details: { label: copy.name, from: original.name } });
    return apiSuccess(copy);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    if (error instanceof Error && error.message === "Forbidden") return apiForbidden();
    return apiServerError(error);
  }
}
