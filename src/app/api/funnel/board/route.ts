import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { apiSuccess, apiError, apiUnauthorized, apiServerError } from "@/lib/api/response";
import { getBoard } from "@/lib/db/queries/funnel";
import type { FunnelType, BoardData } from "@/types/funnel";

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth();
    const typeParam = req.nextUrl.searchParams.get("type") as FunnelType | null;
    if (typeParam !== "locacao" && typeParam !== "vendas") return apiError("type inválido (locacao|vendas)", 400);
    const pipelineId = req.nextUrl.searchParams.get("pipeline_id") || undefined;
    const showUnassigned = req.nextUrl.searchParams.get("unassigned") !== "0";
    const board = await getBoard(user.company_id, typeParam, pipelineId, { showUnassigned });
    return apiSuccess(board);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    // Sem tabelas ainda — devolve board vazio pra UI degradar.
    const empty: BoardData = { pipeline: null, pipelines: [], stages: [], deals: [] };
    if (error instanceof Error && /relation|does not exist|schema cache/i.test(error.message)) return apiSuccess(empty);
    return apiServerError(error);
  }
}
