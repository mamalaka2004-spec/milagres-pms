import Link from "next/link";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import {
  calendarHref,
  shiftMonth,
  shiftDay,
  MONTH_NAMES,
  WEEKDAY_NAMES,
  daysInMonthOf,
  type CalendarParams,
} from "@/lib/calendar/view";

/**
 * Period stepper that adapts to the active view:
 *   lista/mes → previous/next month
 *   dia       → previous/next day
 *   ano       → previous/next year
 * Plus a "Hoje" shortcut when not viewing the current period.
 */
export function PeriodNav({ params }: { params: CalendarParams }) {
  const now = new Date();
  const { view, year, month, day } = params;

  let prevHref: string;
  let nextHref: string;
  let label: string;
  let prevAria: string;
  let nextAria: string;
  let isCurrent: boolean;

  if (view === "dia") {
    const cur = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const p = parseYmd(shiftDay(cur, -1));
    const n = parseYmd(shiftDay(cur, 1));
    prevHref = calendarHref({ view, year: p.year, month: p.month, day: p.day });
    nextHref = calendarHref({ view, year: n.year, month: n.month, day: n.day });
    const wd = WEEKDAY_NAMES[new Date(cur + "T00:00:00Z").getUTCDay()];
    label = `${day} de ${MONTH_NAMES[month - 1]}`;
    prevAria = "Dia anterior";
    nextAria = "Próximo dia";
    isCurrent =
      now.getFullYear() === year && now.getMonth() + 1 === month && now.getDate() === day;
    return (
      <NavBar
        prevHref={prevHref}
        nextHref={nextHref}
        label={label}
        sublabel={wd}
        prevAria={prevAria}
        nextAria={nextAria}
        isCurrent={isCurrent}
        todayHref={calendarHref({
          view,
          year: now.getFullYear(),
          month: now.getMonth() + 1,
          day: now.getDate(),
        })}
      />
    );
  }

  if (view === "ano") {
    prevHref = calendarHref({ view, year: year - 1, month, day });
    nextHref = calendarHref({ view, year: year + 1, month, day });
    label = String(year);
    prevAria = "Ano anterior";
    nextAria = "Próximo ano";
    isCurrent = now.getFullYear() === year;
    return (
      <NavBar
        prevHref={prevHref}
        nextHref={nextHref}
        label={label}
        prevAria={prevAria}
        nextAria={nextAria}
        isCurrent={isCurrent}
        todayHref={calendarHref({ view, year: now.getFullYear(), month, day })}
      />
    );
  }

  // lista | mes → month stepper
  const prev = shiftMonth(year, month, -1);
  const next = shiftMonth(year, month, 1);
  prevHref = calendarHref({ view, year: prev.year, month: prev.month, day });
  nextHref = calendarHref({ view, year: next.year, month: next.month, day });
  label = `${MONTH_NAMES[month - 1]} ${year}`;
  prevAria = "Mês anterior";
  nextAria = "Próximo mês";
  isCurrent = now.getFullYear() === year && now.getMonth() + 1 === month;
  const todayMonth = now.getMonth() + 1;
  const todayDay = Math.min(day, daysInMonthOf(now.getFullYear(), todayMonth));
  return (
    <NavBar
      prevHref={prevHref}
      nextHref={nextHref}
      label={label}
      prevAria={prevAria}
      nextAria={nextAria}
      isCurrent={isCurrent}
      todayHref={calendarHref({ view, year: now.getFullYear(), month: todayMonth, day: todayDay })}
    />
  );
}

function parseYmd(s: string): { year: number; month: number; day: number } {
  const [y, m, d] = s.split("-").map((x) => parseInt(x, 10));
  return { year: y, month: m, day: d };
}

function NavBar({
  prevHref,
  nextHref,
  label,
  sublabel,
  prevAria,
  nextAria,
  isCurrent,
  todayHref,
}: {
  prevHref: string;
  nextHref: string;
  label: string;
  sublabel?: string;
  prevAria: string;
  nextAria: string;
  isCurrent: boolean;
  todayHref: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 flex-wrap">
      <div className="flex items-center gap-2">
        <Link
          href={prevHref}
          className="h-10 w-10 flex items-center justify-center rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-600 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40"
          aria-label={prevAria}
        >
          <ChevronLeft size={18} aria-hidden="true" />
        </Link>
        <div className="px-5 h-10 flex flex-col items-center justify-center rounded-xl bg-white border border-gray-200 min-w-[180px]">
          <span className="font-heading text-lg text-gray-900 capitalize leading-none">{label}</span>
          {sublabel && <span className="text-[10px] text-gray-400 capitalize leading-none mt-0.5">{sublabel}</span>}
        </div>
        <Link
          href={nextHref}
          className="h-10 w-10 flex items-center justify-center rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-600 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40"
          aria-label={nextAria}
        >
          <ChevronRight size={18} aria-hidden="true" />
        </Link>
      </div>
      {!isCurrent && (
        <Link
          href={todayHref}
          className="inline-flex items-center gap-2 px-4 h-10 rounded-xl text-sm font-semibold border border-brand-500/30 bg-brand-500/5 hover:bg-brand-500/10 text-brand-700 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40"
        >
          <CalendarDays size={15} aria-hidden="true" /> Hoje
        </Link>
      )}
    </div>
  );
}
