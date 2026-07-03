import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import { logActivity } from "@/lib/audit/log";
import { apiSuccess, apiError, apiUnauthorized, apiForbidden, apiServerError } from "@/lib/api/response";
import { listAgents, createAgent } from "@/lib/db/queries/ai-agents";
import { agentCreateSchema } from "@/lib/validations/ai-agent";

export async function GET() {
  try {
    const user = await requireRole(["admin", "manager"]);
    const data = await listAgents(user.company_id);
    return apiSuccess(data);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    if (error instanceof Error && error.message === "Forbidden") return apiForbidden();
    return apiServerError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireRole(["admin", "manager"]);
    const parsed = agentCreateSchema.safeParse(await req.json());
    if (!parsed.success) return apiError("Dados inválidos", 400, parsed.error.flatten());
    const agent = await createAgent(user.company_id, parsed.data, user.id);
    await logActivity({ user, action: "ai_agent.create", entityType: "ai_agent", entityId: agent.id, details: { label: agent.name } });
    return apiSuccess(agent, 201);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    if (error instanceof Error && error.message === "Forbidden") return apiForbidden();
    return apiServerError(error);
  }
}

export const dynamic = "force-dynamic";
