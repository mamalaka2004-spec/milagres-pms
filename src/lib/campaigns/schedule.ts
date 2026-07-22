// ===========================================================================
// Helpers de janela/agenda de campanha — espelho TS de
// supabase/functions/campaign-tick/campaign-utils.ts (manter em sincronia).
// Usados pelo enqueue (distribuição de scheduled_for) no lado Next.
// ===========================================================================
import type { CampaignSchedule } from "@/types/campaign";

export function randInt(min: number, max: number): number {
  const lo = Math.min(min, max);
  const hi = Math.max(min, max);
  return Math.floor(Math.random() * (hi - lo + 1)) + lo;
}

/** "HH:MM" → minutos desde a meia-noite (NaN vira -1). */
function toMinutes(hhmm: string, fallback: number): number {
  const [h, m] = (hhmm || "").split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return fallback;
  return h * 60 + m;
}

/**
 * Janela utilizável? Exige ao menos um dia e fim DEPOIS do início.
 * Uma janela invertida (ex.: 09:00→07:00) nunca contém instante algum — sem
 * este guard, `nextSlot` varre 14 dias e devolve uma data lá na frente,
 * fazendo a campanha "sumir" em silêncio.
 */
export function windowIsValid(schedule: CampaignSchedule): boolean {
  const days = schedule?.days?.length ? schedule.days : [1, 2, 3, 4, 5];
  const start = toMinutes(schedule?.start_time ?? "", 9 * 60);
  const end = toMinutes(schedule?.end_time ?? "", 18 * 60);
  return days.length > 0 && end > start;
}

/**
 * Próximo instante válido dentro da janela (dias/horários no timezone), a
 * partir de `from` — retorna o próprio `from` se já estiver dentro.
 * `null` quando a janela é inválida ou não há slot nos próximos 14 dias.
 */
export function nextSlot(from: Date, schedule: CampaignSchedule): Date | null {
  if (!windowIsValid(schedule)) return null;
  const tz = schedule.timezone || "America/Sao_Paulo";
  const days = schedule.days?.length ? schedule.days : [1, 2, 3, 4, 5];
  const startM = toMinutes(schedule.start_time, 9 * 60);
  const endM = toMinutes(schedule.end_time, 18 * 60);

  let cursor = new Date(from);
  for (let i = 0; i < 14 * 24 * 60; i++) {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(cursor);
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
    const wdMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    const wd = wdMap[get("weekday")] ?? 1;
    const cur = parseInt(get("hour"), 10) * 60 + parseInt(get("minute"), 10);
    if (days.includes(wd) && cur >= startM && cur < endM) return cursor;
    cursor = new Date(cursor.getTime() + 60_000);
  }
  return null;
}

export function isInsideWindow(now: Date, schedule: CampaignSchedule): boolean {
  const slot = nextSlot(now, schedule);
  return !!slot && slot.getTime() - now.getTime() < 60_000;
}

/** Descrição curta da janela para mensagens de erro/UI. */
export function describeWindow(schedule: CampaignSchedule): string {
  const DAYS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
  const days = (schedule?.days ?? []).map((d) => DAYS[d] ?? d).join(", ");
  return `${days || "nenhum dia"} · ${schedule?.start_time ?? "?"}–${schedule?.end_time ?? "?"}`;
}
