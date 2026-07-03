import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import { logActivity } from "@/lib/audit/log";
import { apiSuccess, apiError, apiUnauthorized, apiForbidden, apiNotFound, apiServerError } from "@/lib/api/response";
import { getRule, updateRule, deleteRule } from "@/lib/db/queries/pricing";
import { pricingRuleSchema } from "@/lib/validations/pricing";
import { ruleInputToRow } from "@/lib/pricing/mappers";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// O formulário sempre envia a regra completa; PATCH revalida com o schema cheio
// para manter a consistência kind/target/adjustment exigida pelos CHECKs do banco.
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireRole(["admin", "manager"]);
    const { id } = await params;
    const parsed = pricingRuleSchema.safeParse(await req.json());
    if (!parsed.success) return apiError("Dados inválidos", 400, parsed.error.flatten());
    const rule = await updateRule(user.company_id, id, ruleInputToRow(parsed.data));
    if (!rule) return apiNotFound("Regra");
    await logActivity({ user, action: "pricing_rule.update", entityType: "pricing_rule", entityId: id, details: { label: rule.name, kind: rule.kind } });
    return apiSuccess(rule);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    if (error instanceof Error && error.message === "Forbidden") return apiForbidden();
    return apiServerError(error);
  }
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireRole(["admin", "manager"]);
    const { id } = await params;
    const rule = await getRule(user.company_id, id);
    if (!rule) return apiNotFound("Regra");
    await deleteRule(user.company_id, id);
    await logActivity({ user, action: "pricing_rule.delete", entityType: "pricing_rule", entityId: id, details: { label: rule.name } });
    return apiSuccess({ deleted: true });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    if (error instanceof Error && error.message === "Forbidden") return apiForbidden();
    return apiServerError(error);
  }
}
