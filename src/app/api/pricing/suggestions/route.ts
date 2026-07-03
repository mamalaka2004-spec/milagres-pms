import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import { logActivity } from "@/lib/audit/log";
import { apiSuccess, apiError, apiUnauthorized, apiForbidden, apiServerError } from "@/lib/api/response";
import { listSuggestions, updateBasePrice, createRule } from "@/lib/db/queries/pricing";
import { applySuggestionSchema } from "@/lib/validations/pricing";

// GET — imóveis + última tarifa sugerida da Análise de Mercado
export async function GET() {
  try {
    const user = await requireRole(["admin", "manager"]);
    const data = await listSuggestions(user.company_id);
    return apiSuccess(data);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    if (error instanceof Error && error.message === "Forbidden") return apiForbidden();
    return apiServerError(error);
  }
}

// POST — aplica em lote: mode 'base' atualiza o preço-base dos imóveis;
// mode 'season' cria uma regra de temporada (preço fixo) por imóvel.
export async function POST(req: NextRequest) {
  try {
    const user = await requireRole(["admin", "manager"]);
    const parsed = applySuggestionSchema.safeParse(await req.json());
    if (!parsed.success) return apiError("Dados inválidos", 400, parsed.error.flatten());
    const { mode, items, season_name, season_start, season_end } = parsed.data;

    const results: Array<{ property_id: string; ok: boolean }> = [];

    for (const item of items) {
      if (mode === "base") {
        const change = await updateBasePrice(user.company_id, item.property_id, item.price_cents);
        if (change) {
          await logActivity({
            user,
            action: "property.price_suggestion_applied",
            entityType: "property",
            entityId: item.property_id,
            details: { label: "Tarifa sugerida → preço base", old_cents: change.old_cents, new_cents: change.new_cents },
          });
        }
        results.push({ property_id: item.property_id, ok: !!change });
      } else {
        const rule = await createRule(user.company_id, user.id, {
          name: season_name?.trim() || `Tarifa sugerida ${season_start} a ${season_end}`,
          kind: "season",
          target_type: "property",
          group_id: null,
          property_id: item.property_id,
          start_date: season_start!,
          end_date: season_end!,
          days_of_week: null,
          adjustment_type: "set",
          price_cents: item.price_cents,
          percent: null,
          min_nights: null,
          priority: 0,
          active: true,
        });
        await logActivity({
          user,
          action: "pricing_rule.create",
          entityType: "pricing_rule",
          entityId: rule.id,
          details: { label: rule.name, kind: "season", from_suggestion: true },
        });
        results.push({ property_id: item.property_id, ok: true });
      }
    }

    return apiSuccess({ mode, applied: results.filter((r) => r.ok).length, results });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    if (error instanceof Error && error.message === "Forbidden") return apiForbidden();
    return apiServerError(error);
  }
}
