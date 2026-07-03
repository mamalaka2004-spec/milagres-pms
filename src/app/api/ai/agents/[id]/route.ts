import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import { logActivity } from "@/lib/audit/log";
import { apiSuccess, apiError, apiNotFound, apiUnauthorized, apiForbidden, apiServerError } from "@/lib/api/response";
import { getAgent, updateAgent, deleteAgent } from "@/lib/db/queries/ai-agents";
import { agentUpdateSchema } from "@/lib/validations/ai-agent";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const user = await requireRole(["admin", "manager"]);
    const { id } = await params;
    const agent = await getAgent(id, user.company_id);
    if (!agent) return apiNotFound("Agente");
    return apiSuccess(agent);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    if (error instanceof Error && error.message === "Forbidden") return apiForbidden();
    return apiServerError(error);
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const user = await requireRole(["admin", "manager"]);
    const { id } = await params;
    const parsed = agentUpdateSchema.safeParse(await req.json());
    if (!parsed.success) return apiError("Dados inválidos", 400, parsed.error.flatten());
    const existing = await getAgent(id, user.company_id);
    if (!existing) return apiNotFound("Agente");
    const updated = await updateAgent(id, user.company_id, parsed.data);
    await logActivity({ user, action: "ai_agent.update", entityType: "ai_agent", entityId: id, details: { label: updated.name } });
    return apiSuccess(updated);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    if (error instanceof Error && error.message === "Forbidden") return apiForbidden();
    return apiServerError(error);
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const user = await requireRole(["admin", "manager"]);
    const { id } = await params;
    const existing = await getAgent(id, user.company_id);
    if (!existing) return apiNotFound("Agente");
    await deleteAgent(id, user.company_id);
    await logActivity({ user, action: "ai_agent.delete", entityType: "ai_agent", entityId: id, details: { label: existing.name } });
    return apiSuccess({ id });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    if (error instanceof Error && error.message === "Forbidden") return apiForbidden();
    return apiServerError(error);
  }
}
