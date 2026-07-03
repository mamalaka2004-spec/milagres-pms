import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import { logActivity } from "@/lib/audit/log";
import { apiSuccess, apiError, apiUnauthorized, apiForbidden, apiServerError } from "@/lib/api/response";
import { listBindings, setBinding, deleteBinding } from "@/lib/db/queries/ai-agents";
import { bindingSetSchema, bindingDeleteSchema } from "@/lib/validations/ai-agent";

export async function GET() {
  try {
    const user = await requireRole(["admin", "manager"]);
    const data = await listBindings(user.company_id);
    return apiSuccess(data);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    if (error instanceof Error && error.message === "Forbidden") return apiForbidden();
    return apiServerError(error);
  }
}

/** Vincula/atualiza qual agente uma linha (ou feature) usa. */
export async function PUT(req: NextRequest) {
  try {
    const user = await requireRole(["admin", "manager"]);
    const parsed = bindingSetSchema.safeParse(await req.json());
    if (!parsed.success) return apiError("Dados inválidos", 400, parsed.error.flatten());
    const binding = await setBinding(user.company_id, parsed.data);
    await logActivity({
      user,
      action: "ai_agent.bind",
      entityType: "ai_agent_binding",
      entityId: binding.id,
      details: { agent_id: binding.agent_id, line_id: binding.line_id, feature: binding.feature },
    });
    return apiSuccess(binding);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    if (error instanceof Error && error.message === "Forbidden") return apiForbidden();
    if (error instanceof Error && /não encontrad/i.test(error.message)) return apiError(error.message, 400);
    return apiServerError(error);
  }
}

/** Remove o vínculo de uma linha/feature (volta ao comportamento default da rota). */
export async function DELETE(req: NextRequest) {
  try {
    const user = await requireRole(["admin", "manager"]);
    const parsed = bindingDeleteSchema.safeParse(await req.json());
    if (!parsed.success) return apiError("Dados inválidos", 400, parsed.error.flatten());
    if (!parsed.data.line_id && !parsed.data.feature) return apiError("Informe line_id ou feature", 400);
    await deleteBinding(user.company_id, parsed.data);
    await logActivity({ user, action: "ai_agent.unbind", entityType: "ai_agent_binding", entityId: parsed.data.line_id || parsed.data.feature || "?", details: parsed.data });
    return apiSuccess({ ok: true });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    if (error instanceof Error && error.message === "Forbidden") return apiForbidden();
    return apiServerError(error);
  }
}
