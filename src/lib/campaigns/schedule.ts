// ===========================================================================
// Helpers de janela/agenda de campanha — espelho TS de
// supabase/functions/_shared/campaign-utils.ts (manter em sincronia).
// Usados pelo enqueue (distribuição de scheduled_for) no lado Next.
// ===========================================================================
import type { CampaignSchedule } from "@/types/campaign";

export function randInt(min: number, max: number): number {
  const lo = Math.min(min, max);
  const hi = Math.max(min, max);
  return Math.floor(Math.random() * (hi - lo + 1)) + lo;
}

/**
 * Próximo instante válido dentro da janela (dias/horários no timezone),
 * a partir de `from` — retorna o próprio `from` se já estiver dentro.
 */
export function nextSlot(from: Date, schedule: CampaignSchedule): Date {
  const tz = schedule.timezone || "America/Sao_Paulo";
  const days = schedule.days?.length ? schedule.days : [1, 2, 3, 4, 5];
  const [sh, sm] = (schedule.start_time || "09:00").split(":").map(Number);
  const [eh, em] = (schedule.end_time || "18:00").split(":").map(Number);

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
    if (days.includes(wd) && cur >= sh * 60 + sm && cur < eh * 60 + em) return cursor;
    cursor = new Date(cursor.getTime() + 60_000);
  }
  return cursor;
}

export function isInsideWindow(now: Date, schedule: CampaignSchedule): boolean {
  const slot = nextSlot(now, schedule);
  return slot.getTime() - now.getTime() < 60_000;
}
