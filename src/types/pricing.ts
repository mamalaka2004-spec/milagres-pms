// ===========================================================================
// Precificação em lote — tipos (Fase 4, migration 026)
// ===========================================================================

export type RuleKind = "season" | "recurring" | "holiday";
export type RuleTargetType = "all" | "group" | "property";
export type RuleAdjustmentType = "set" | "percent";

export interface PropertyGroup {
  id: string;
  company_id: string;
  name: string;
  description: string | null;
  color: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
  /** ids dos imóveis membros (populado por listGroups) */
  member_ids?: string[];
}

export interface Holiday {
  id: string;
  company_id: string;
  name: string;
  date: string; // YYYY-MM-DD (ano canônico quando recurring)
  recurring: boolean;
  created_at: string;
}

export interface PricingRule {
  id: string;
  company_id: string;
  name: string;
  kind: RuleKind;
  target_type: RuleTargetType;
  group_id: string | null;
  property_id: string | null;
  start_date: string | null;
  end_date: string | null;
  days_of_week: number[] | null; // 0=domingo … 6=sábado
  adjustment_type: RuleAdjustmentType;
  price_cents: number | null;
  percent: number | null;
  min_nights: number | null;
  priority: number;
  active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

/** Preço resolvido de uma noite, com as regras que a afetaram (por camada). */
export interface NightPrice {
  date: string; // YYYY-MM-DD
  price_cents: number;
  applied: Array<{ id: string; name: string; kind: RuleKind }>;
  holiday_name: string | null;
}

export interface PricingQuote {
  property_id: string;
  check_in: string;
  check_out: string;
  nights: NightPrice[];
  total_cents: number;
  base_price_cents: number;
  /** maior min_nights entre as regras aplicadas (null = sem override) */
  min_nights_required: number | null;
}

/** Linha da aba Tarifa Sugerida: imóvel + última sugestão do mercado. */
export interface PropertySuggestion {
  property_id: string;
  name: string;
  code: string;
  base_price_cents: number;
  suggested_nightly: number | null; // R$ (numeric do snapshot)
  source: string | null;
  sample_size: number | null;
  captured_at: string | null;
}

export const RULE_KIND_LABELS: Record<RuleKind, string> = {
  season: "Temporada",
  recurring: "Dias da semana",
  holiday: "Feriado",
};

export const RULE_TARGET_LABELS: Record<RuleTargetType, string> = {
  all: "Todos os imóveis",
  group: "Grupo",
  property: "Imóvel",
};

export const DAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
