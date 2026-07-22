import { NextRequest } from "next/server";
import { requireFullAccess } from "@/lib/auth";
import { apiSuccess, apiUnauthorized, apiForbidden, apiNotFound, apiServerError } from "@/lib/api/response";
import { getCampaignLive } from "@/lib/db/queries/campaign";

/**
 * Estado ao vivo da campanha para o drawer de acompanhamento: contadores,
 * próximo envio (geral e por passo da cadência) e fila de destinatários.
 * Chamado em polling curto enquanto a campanha está ativa.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireFullAccess();
    const { id } = await params;
    const live = await getCampaignLive(id);
    if (!live) return apiNotFound("Campanha");
    if (live.campaign.company_id !== user.company_id) return apiForbidden();
    return apiSuccess(live);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    if (error instanceof Error && error.message === "Forbidden") return apiForbidden();
    return apiServerError(error);
  }
}
