import Link from "next/link";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";

interface MonthNavProps {
  year: number;
  month: number; // 1-12
}

const MONTH_NAMES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  let m = month + delta;
  let y = year;
  while (m < 1) {
    m += 12;
    y -= 1;
  }
  while (m > 12) {
    m -= 12;
    y += 1;
  }
  return { year: y, month: m };
}

function buildHref(year: number, month: number) {
  return `/calendar?year=${year}&month=${month}`;
}

export function MonthNav({ year, month }: MonthNavProps) {
  const prev = shiftMonth(year, month, -1);
  const next = shiftMonth(year, month, 1);
  const today = new Date();
  const todayHref = buildHref(today.getFullYear(), today.getMonth() + 1);
  const isToday = today.getFullYear() === year && today.getMonth() + 1 === month;

  return (
    <div className="flex items-center justify-between gap-3 flex-wrap">
      <div className="flex items-center gap-2">
        <Link
          href={buildHref(prev.year, prev.month)}
          className="h-10 w-10 flex items-center justify-center rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-600 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40"
          aria-label="Mês anterior"
        >
          <ChevronLeft size={18} aria-hidden="true" />
        </Link>
        <div className="px-5 h-10 flex items-center rounded-xl bg-white border border-gray-200 min-w-[180px] justify-center">
          <span className="font-heading text-lg text-gray-900 capitalize">
            {MONTH_NAMES[month - 1]} {year}
          </span>
        </div>
        <Link
          href={buildHref(next.year, next.month)}
          className="h-10 w-10 flex items-center justify-center rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-600 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40"
          aria-label="Próximo mês"
        >
          <ChevronRight size={18} aria-hidden="true" />
        </Link>
      </div>
      {!isToday && (
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
