import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { logActivity } from "@/lib/audit/log";
import { apiSuccess, apiError, apiUnauthorized, apiForbidden, apiServerError } from "@/lib/api/response";
import { getPipeline, getStage } from "@/lib/db/queries/funnel";
import { assignContactsToStage } from "@/lib/db/queries/campaign";
import { prospectSchema } from "@/lib/validations/campaign";

/** Cross-base: joga contatos selecionados (de qualquer base) numa etapa de um
 *  funil (cria um negócio por contato). Base da prospecção/campanha. */
export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth();
    const parsed = prospectSchema.safeParse(await req.json());
    if (!parsed.success) return apiError("Dados inválidos", 400, parsed.error.flatten());

    const pipe = await getPipeline(parsed.data.pipeline_id);
    if (!pipe || pipe.company_id !== user.company_id) return apiForbidden();
    const stage = await getStage(parsed.data.stage_id);
    if (!stage || stage.pipeline_id !== pipe.id) return apiError("Etapa inválida para este funil", 400);

    const created = await assignContactsToStage(
      user.company_id,
      user.id,
      parsed.data.pipeline_id,
      parsed.data.stage_id,
      parsed.data.contact_ids
    );
    await logActivity({ user, action: "funnel.prospect", entityType: "funnel_pipeline", entityId: pipe.id, details: { created, stage: stage.name } });
    return apiSuccess({ created });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    if (error instanceof Error && error.message === "Forbidden") return apiForbidden();
    return apiServerError(error);
  }
}
