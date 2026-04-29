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
          className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-600"
          aria-label="Previous month"
        >
          <ChevronLeft size={16} />
        </Link>
        <div className="px-4 py-2 rounded-lg bg-white border border-gray-200">
          <div className="font-heading text-lg text-gray-900">
            {MONTH_NAMES[month - 1]} {year}
          </div>
        </div>
        <Link
          href={buildHref(next.year, next.month)}
          className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-600"
          aria-label="Next month"
        >
          <ChevronRight size={16} />
        </Link>
      </div>
      {!isToday && (
        <Link
          href={todayHref}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold border border-gray-200 hover:bg-gray-50 text-gray-700"
        >
          <CalendarDays size={14} /> Today
        </Link>
      )}
    </div>
  );
}
