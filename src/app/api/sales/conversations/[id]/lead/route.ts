import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { requireLineAccess } from "@/lib/whatsapp/auth";
import { getConversationById } from "@/lib/db/queries/whatsapp";
import { getLeadData, upsertLeadData } from "@/lib/db/queries/sales";
import { leadDataPatchSchema } from "@/lib/validations/sales";
import {
  apiSuccess,
  apiError,
  apiUnauthorized,
  apiForbidden,
  apiNotFound,
  apiServerError,
} from "@/lib/api/response";

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const user = await requireAuth();
    const { id } = await params;
    const conv = await getConversationById(id);
    if (!conv) return apiNotFound("Conversation");
    if (conv.company_id !== user.company_id) return apiForbidden();
    await requireLineAccess(user, conv.line_id);
    const lead = await getLeadData(id);
    return apiSuccess(lead);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    if (error instanceof Error && error.message === "Forbidden") return apiForbidden();
    return apiServerError(error);
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const user = await requireAuth();
    const { id } = await params;
    const conv = await getConversationById(id);
    if (!conv) return apiNotFound("Conversation");
    if (conv.company_id !== user.company_id) return apiForbidden();
    await requireLineAccess(user, conv.line_id);

    const body = await req.json();
    const validation = leadDataPatchSchema.safeParse(body);
    if (!validation.success) return apiError("Validation failed", 400, validation.error.flatten());

    const data = validation.data;
    const lead = await upsertLeadData({
      conversationId: id,
      leadStage: data.lead_stage,
      objetivo: data.objetivo,
      orcamento: data.orcamento,
      confidenceScore: data.confidence_score,
      reasoning: data.reasoning,
      propertyOfInterest: data.property_of_interest,
      closedReason: data.closed_reason,
      // marcelo_handoff_at auto-set when stage transitions to handoff
      marceloHandoffAt:
        data.lead_stage === "handoff" ? new Date().toISOString() : undefined,
    });
    return apiSuccess(lead);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    if (error instanceof Error && error.message === "Forbidden") return apiForbidden();
    return apiServerError(error);
  }
}
