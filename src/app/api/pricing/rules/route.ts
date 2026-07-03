import { NextRequest } from "next/server";
import { requireAuth, requireRole } from "@/lib/auth";
import { logActivity } from "@/lib/audit/log";
import { apiSuccess, apiError, apiUnauthorized, apiForbidden, apiServerError } from "@/lib/api/response";
import { listRules, createRule } from "@/lib/db/queries/pricing";
import { pricingRuleSchema } from "@/lib/validations/pricing";
import { ruleInputToRow } from "@/lib/pricing/mappers";

export async function GET() {
  try {
    const user = await requireAuth();
    const data = await listRules(user.company_id);
    return apiSuccess(data);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    // Tabela ainda não existe (migration 026 não rodada) — degrada.
    return apiSuccess([]);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireRole(["admin", "manager"]);
    const parsed = pricingRuleSchema.safeParse(await req.json());
    if (!parsed.success) return apiError("Dados inválidos", 400, parsed.error.flatten());
    const rule = await createRule(user.company_id, user.id, ruleInputToRow(parsed.data));
    await logActivity({ user, action: "pricing_rule.create", entityType: "pricing_rule", entityId: rule.id, details: { label: rule.name, kind: rule.kind } });
    return apiSuccess(rule, 201);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    if (error instanceof Error && error.message === "Forbidden") return apiForbidden();
    return apiServerError(error);
  }
}
