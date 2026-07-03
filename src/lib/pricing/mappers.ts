import type { PricingRuleInput } from "@/lib/validations/pricing";
import type { RuleRow } from "@/lib/db/queries/pricing";

/**
 * Normaliza o input validado do formulário para a linha de pricing_rules:
 * zera campos que não pertencem ao kind/target/adjustment escolhidos (os
 * CHECKs da migration exigem isso) e converte preço R$ → cents.
 */
export function ruleInputToRow(input: PricingRuleInput): RuleRow {
  return {
    name: input.name,
    kind: input.kind,
    target_type: input.target_type,
    group_id: input.target_type === "group" ? input.group_id ?? null : null,
    property_id: input.target_type === "property" ? input.property_id ?? null : null,
    start_date: input.kind === "season" ? input.start_date ?? null : null,
    end_date: input.kind === "season" ? input.end_date ?? null : null,
    days_of_week: input.kind === "recurring" ? input.days_of_week ?? null : null,
    adjustment_type: input.adjustment_type,
    price_cents:
      input.adjustment_type === "set" && input.price != null
        ? Math.round(input.price * 100)
        : null,
    percent: input.adjustment_type === "percent" ? input.percent ?? null : null,
    min_nights: input.min_nights ?? null,
    priority: input.priority,
    active: input.active,
  };
}
