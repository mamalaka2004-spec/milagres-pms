// Shared helpers for the campaign module.

export interface CampaignSchedule {
  timezone: string;
  days: number[]; // 0=Sun..6=Sat
  start_time: string; // "HH:MM"
  end_time: string; // "HH:MM"
}

/** Expand spintax {a|b|c} recursively. Only matches groups containing a pipe so {{var}} stays intact. */
export function expandSpintax(input: string): string {
  if (!input) return input;
  const re = /\{([^{}]*\|[^{}]*)\}/;
  let out = input;
  let guard = 0;
  while (re.test(out) && guard < 100) {
    out = out.replace(re, (_m, body) => {
      const opts = String(body).split("|");
      return opts[Math.floor(Math.random() * opts.length)];
    });
    guard++;
  }
  return out;
}


/** Replace {{var}} occurrences with values from `vars` (case-insensitive). */
export function substituteVars(template: string, vars: Record<string, unknown>): string {
  if (!template) return template;
  const map = new Map<string, string>();
  for (const [k, v] of Object.entries(vars ?? {})) {
    map.set(k.toLowerCase(), v == null ? "" : String(v));
  }
  return template.replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (_m, key) => {
    const v = map.get(String(key).toLowerCase());
    return v == null ? "" : v;
  });
}

/** Pick a uniform random int in [min, max]. */
export function randInt(min: number, max: number): number {
  const lo = Math.min(min, max);
  const hi = Math.max(min, max);
  return Math.floor(Math.random() * (hi - lo + 1)) + lo;
}

/** Sleep ms. */
export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Compute the next valid datetime (ISO) inside the schedule window, starting at `from`.
 * Returns `from` itself when already inside the window.
 */
export function nextSlot(from: Date, schedule: CampaignSchedule): Date {
  const tz = schedule.timezone || "America/Sao_Paulo";
  const days = schedule.days?.length ? schedule.days : [1, 2, 3, 4, 5];
  const [sh, sm] = (schedule.start_time || "09:00").split(":").map(Number);
  const [eh, em] = (schedule.end_time || "18:00").split(":").map(Number);

  // Iterate at most 14 days ahead.
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
    const hh = parseInt(get("hour"), 10);
    const mm = parseInt(get("minute"), 10);
    const cur = hh * 60 + mm;
    const startM = sh * 60 + sm;
    const endM = eh * 60 + em;

    if (days.includes(wd) && cur >= startM && cur < endM) return cursor;

    // jump to next minute step (coarse — 1 minute is good enough since intervals are ≥ 30s)
    cursor = new Date(cursor.getTime() + 60_000);
  }
  return cursor;
}

/** True when `now` falls inside the schedule window. */
export function isInsideWindow(now: Date, schedule: CampaignSchedule): boolean {
  const slot = nextSlot(now, schedule);
  return slot.getTime() === now.getTime() || slot.getTime() - now.getTime() < 60_000;
}

/** Offset (minutes) of `tz` at instant `date`, i.e. (local wall clock) - UTC. */
function tzOffsetMinutes(date: Date, tz: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, hour12: false,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
  const map: Record<string, string> = {};
  for (const p of dtf.formatToParts(date)) map[p.type] = p.value;
  const asUTC = Date.UTC(+map.year, +map.month - 1, +map.day, +map.hour, +map.minute, +map.second);
  return (asUTC - date.getTime()) / 60000;
}

/**
 * UTC instant of local midnight (start of "today") in `tz`.
 * Used to count "envios de hoje" no fuso da campanha (e não do servidor/UTC).
 */
export function startOfDayUtc(now: Date, tz: string): Date {
  const dtf = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
  });
  const [y, m, d] = dtf.format(now).split("-").map(Number);
  const guessUtc = Date.UTC(y, m - 1, d, 0, 0, 0);
  const off = tzOffsetMinutes(new Date(guessUtc), tz);
  return new Date(guessUtc - off * 60000);
}
