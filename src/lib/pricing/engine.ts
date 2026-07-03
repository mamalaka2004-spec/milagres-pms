// ===========================================================================
// Motor de tarifa — resolução do preço/noite em camadas (Fase 4)
//
//   base (properties.base_price_cents)
//     → temporada (season: intervalo de datas)
//       → dias da semana (recurring: days_of_week)
//         → feriado (holiday: calendário `holidays`)
//
// Cada camada pode SOBREPOR (set: preço fixo) ou AJUSTAR (percent: ±% sobre a
// camada anterior). Dentro da mesma camada vence a regra de maior `priority`;
// empate → escopo mais específico (imóvel > grupo > todos) → mais recente.
// Funções puras: as regras recebidas já devem estar filtradas para o imóvel
// (target all | grupo do imóvel | o próprio imóvel) e ativas.
// ===========================================================================
import type { Holiday, NightPrice, PricingRule, RuleKind } from "@/types/pricing";

const LAYERS: RuleKind[] = ["season", "recurring", "holiday"];

const SCOPE_WEIGHT: Record<PricingRule["target_type"], number> = {
  all: 0,
  group: 1,
  property: 2,
};

/** Dia da semana (0=domingo) de uma data YYYY-MM-DD, sem drift de fuso. */
export function dayOfWeek(date: string): number {
  return new Date(`${date}T12:00:00`).getDay();
}

function toDateString(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

/** Datas das noites de uma estadia: [check_in, check_out) */
export function nightsBetween(checkIn: string, checkOut: string): string[] {
  const nights: string[] = [];
  const cursor = new Date(`${checkIn}T12:00:00`);
  const end = new Date(`${checkOut}T12:00:00`);
  while (cursor < end) {
    nights.push(toDateString(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return nights;
}

export function holidayFor(date: string, holidays: Holiday[]): Holiday | null {
  const monthDay = date.slice(5); // MM-DD
  return (
    holidays.find((h) =>
      h.recurring ? h.date.slice(5) === monthDay : h.date === date
    ) ?? null
  );
}

function matchesDate(rule: PricingRule, date: string, holiday: Holiday | null): boolean {
  switch (rule.kind) {
    case "season":
      return !!rule.start_date && !!rule.end_date && date >= rule.start_date && date <= rule.end_date;
    case "recurring":
      return !!rule.days_of_week?.includes(dayOfWeek(date));
    case "holiday":
      return holiday !== null;
  }
}

/** Vencedora da camada: priority > especificidade do escopo > mais recente. */
function pickWinner(candidates: PricingRule[]): PricingRule | null {
  if (candidates.length === 0) return null;
  return [...candidates].sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    const scope = SCOPE_WEIGHT[b.target_type] - SCOPE_WEIGHT[a.target_type];
    if (scope !== 0) return scope;
    return b.created_at.localeCompare(a.created_at);
  })[0];
}

function applyAdjustment(current: number, rule: PricingRule): number {
  if (rule.adjustment_type === "set") return rule.price_cents ?? current;
  return Math.max(0, Math.round(current * (1 + (rule.percent ?? 0) / 100)));
}

export function resolveNightPrice(
  date: string,
  basePriceCents: number,
  rules: PricingRule[],
  holidays: Holiday[]
): NightPrice {
  const holiday = holidayFor(date, holidays);
  let price = basePriceCents;
  const applied: NightPrice["applied"] = [];

  for (const layer of LAYERS) {
    const winner = pickWinner(
      rules.filter((r) => r.kind === layer && matchesDate(r, date, holiday))
    );
    if (winner) {
      price = applyAdjustment(price, winner);
      applied.push({ id: winner.id, name: winner.name, kind: winner.kind });
    }
  }

  return { date, price_cents: price, applied, holiday_name: holiday?.name ?? null };
}

export function resolveNights(
  checkIn: string,
  checkOut: string,
  basePriceCents: number,
  rules: PricingRule[],
  holidays: Holiday[]
): NightPrice[] {
  return nightsBetween(checkIn, checkOut).map((date) =>
    resolveNightPrice(date, basePriceCents, rules, holidays)
  );
}

/** Maior min_nights entre as regras aplicadas nas noites (null = sem override). */
export function minNightsRequired(nights: NightPrice[], rules: PricingRule[]): number | null {
  const appliedIds = new Set(nights.flatMap((n) => n.applied.map((a) => a.id)));
  const mins = rules
    .filter((r) => appliedIds.has(r.id) && r.min_nights != null)
    .map((r) => r.min_nights as number);
  return mins.length ? Math.max(...mins) : null;
}
