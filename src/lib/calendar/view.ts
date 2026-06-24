// Shared, framework-agnostic helpers for the Agenda multi-view (Lista/Dia/Mês/Ano).
// Pure functions only — safe to import from server and client components.

export type CalendarView = "lista" | "dia" | "mes" | "ano";

export const CALENDAR_VIEWS: { value: CalendarView; label: string }[] = [
  { value: "lista", label: "Lista" },
  { value: "dia", label: "Dia" },
  { value: "mes", label: "Mês" },
  { value: "ano", label: "Ano" },
];

export interface CalendarParams {
  view: CalendarView;
  year: number;
  month: number; // 1-12
  day: number; // 1-31
}

export const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];
export const MONTH_NAMES_SHORT = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez",
];
export const WEEKDAY_LABELS = ["D", "S", "T", "Q", "Q", "S", "S"];
export const WEEKDAY_NAMES = [
  "domingo", "segunda-feira", "terça-feira", "quarta-feira",
  "quinta-feira", "sexta-feira", "sábado",
];

const DAY_MS = 24 * 60 * 60 * 1000;

export function isCalendarView(v: string | undefined): v is CalendarView {
  return v === "lista" || v === "dia" || v === "mes" || v === "ano";
}

/** Parse raw searchParams into a normalized {view, year, month, day}, defaulting to today. */
export function parseCalendarParams(params: {
  view?: string;
  year?: string;
  month?: string;
  day?: string;
}): CalendarParams {
  const now = new Date();
  const view: CalendarView = isCalendarView(params.view) ? params.view : "mes";

  let year = parseInt(params.year || "", 10);
  let month = parseInt(params.month || "", 10);
  let day = parseInt(params.day || "", 10);
  if (!Number.isFinite(year) || year < 2000 || year > 3000) year = now.getFullYear();
  if (!Number.isFinite(month) || month < 1 || month > 12) month = now.getMonth() + 1;

  const lastDay = new Date(year, month, 0).getDate();
  if (!Number.isFinite(day) || day < 1 || day > lastDay) {
    // default day = today if same month, else the 1st
    day = now.getFullYear() === year && now.getMonth() + 1 === month ? now.getDate() : 1;
  }
  return { view, year, month, day };
}

/** Build a /calendar href, overriding any subset of the current params. */
export function calendarHref(p: Partial<CalendarParams>): string {
  const q = new URLSearchParams();
  if (p.view) q.set("view", p.view);
  if (p.year) q.set("year", String(p.year));
  if (p.month) q.set("month", String(p.month));
  if (p.day) q.set("day", String(p.day));
  return `/calendar?${q.toString()}`;
}

export function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export function ymd(year: number, month: number, day: number): string {
  return `${year}-${pad(month)}-${pad(day)}`;
}

export function daysInMonthOf(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/** Days between two YYYY-MM-DD strings (b - a), UTC-safe. */
export function daysBetween(a: string, b: string): number {
  return Math.round(
    (new Date(b + "T00:00:00Z").getTime() - new Date(a + "T00:00:00Z").getTime()) / DAY_MS
  );
}

/** Shift a YYYY-MM-DD by a number of days. */
export function shiftDay(date: string, delta: number): string {
  const d = new Date(date + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

export function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  let m = month + delta;
  let y = year;
  while (m < 1) { m += 12; y -= 1; }
  while (m > 12) { m -= 12; y += 1; }
  return { year: y, month: m };
}

/** Weekday name for a YYYY-MM-DD (UTC-safe). */
export function weekdayOf(date: string): number {
  return new Date(date + "T00:00:00Z").getUTCDay();
}

/**
 * The data window to fetch for a given view.
 * Returns inclusive [from, to] YYYY-MM-DD strings passed to getCalendarData.
 */
export function windowForView(p: CalendarParams): { from: string; to: string } {
  switch (p.view) {
    case "dia": {
      const d = ymd(p.year, p.month, p.day);
      // widen `to` by one day so blocks starting on `d` are fetched (the block
      // query uses start_date < to); the day-board filters precisely afterwards.
      return { from: d, to: shiftDay(d, 1) };
    }
    case "ano": {
      return { from: `${p.year}-01-01`, to: `${p.year}-12-31` };
    }
    case "lista":
    case "mes":
    default: {
      const last = daysInMonthOf(p.year, p.month);
      return { from: ymd(p.year, p.month, 1), to: ymd(p.year, p.month, last) };
    }
  }
}
