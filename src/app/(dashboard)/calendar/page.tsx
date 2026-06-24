import { requireAuth } from "@/lib/auth";
import { getCalendarData } from "@/lib/db/queries/calendar";
import { CalendarGrid } from "@/components/calendar/calendar-grid";
import { ReservationList } from "@/components/calendar/reservation-list";
import { DayBoard } from "@/components/calendar/day-board";
import { YearGrid } from "@/components/calendar/year-grid";
import { ViewSwitcher } from "@/components/calendar/view-switcher";
import { PeriodNav } from "@/components/calendar/period-nav";
import {
  parseCalendarParams,
  windowForView,
  daysBetween,
  daysInMonthOf,
  ymd,
  type CalendarView,
} from "@/lib/calendar/view";
import { CalendarDays, LogIn, LogOut, Percent, BedDouble, MoonStar, Home } from "lucide-react";
import type { CalendarReservation } from "@/lib/db/queries/calendar";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ view?: string; year?: string; month?: string; day?: string }>;
}

type Stat = { label: string; value: string | number; icon: typeof CalendarDays };

const SUBTITLES: Record<CalendarView, string> = {
  lista: "Reservas do mês em lista, agrupadas por chegada.",
  dia: "Chegadas, saídas e hóspedes no imóvel — visão operacional do dia.",
  mes: "Visão mensal de reservas e bloqueios por imóvel.",
  ano: "Mapa de ocupação por imóvel ao longo dos 12 meses.",
};

export default async function CalendarPage({ searchParams }: PageProps) {
  const user = await requireAuth();
  const params = parseCalendarParams(await searchParams);
  const { view, year, month, day } = params;
  const { from, to } = windowForView(params);

  const data = await getCalendarData(user.company_id, from, to);
  const visibleProps = data.properties.filter((p) => p.status !== "inactive");
  const propIds = new Set(visibleProps.map((p) => p.id));
  const reservations = data.reservations.filter((r) => propIds.has(r.property_id));
  const blocks = data.blocks.filter((b) => propIds.has(b.property_id));

  const stats = computeStats(view, { year, month, day }, visibleProps.length, reservations, blocks.length);

  const monthStart = ymd(year, month, 1);
  const daysInMonth = daysInMonthOf(year, month);
  const dayStr = ymd(year, month, day);

  return (
    <div className="space-y-5 lg:space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="font-heading text-2xl lg:text-3xl text-gray-900">Agenda</h1>
          <p className="text-sm text-gray-500">{SUBTITLES[view]}</p>
        </div>
        <ViewSwitcher params={params} />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        {stats.map((s) => (
          <div
            key={s.label}
            className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 lg:p-5 flex items-center gap-4"
          >
            <div className="w-11 h-11 rounded-xl bg-brand-500/10 text-brand-600 flex items-center justify-center shrink-0">
              <s.icon size={20} aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <div className="text-2xl font-bold text-gray-900 tabular-nums leading-none">{s.value}</div>
              <div className="text-xs text-gray-500 mt-1 truncate">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      <PeriodNav params={params} />

      {view === "mes" && (
        <CalendarGrid
          monthStart={monthStart}
          daysInMonth={daysInMonth}
          properties={visibleProps}
          reservations={reservations}
          blocks={blocks}
        />
      )}
      {view === "lista" && <ReservationList reservations={reservations} properties={visibleProps} />}
      {view === "dia" && (
        <DayBoard day={dayStr} reservations={reservations} blocks={blocks} properties={visibleProps} />
      )}
      {view === "ano" && <YearGrid year={year} reservations={reservations} properties={visibleProps} />}
    </div>
  );
}

function computeStats(
  view: CalendarView,
  p: { year: number; month: number; day: number },
  unitCount: number,
  reservations: CalendarReservation[],
  blockCount: number
): Stat[] {
  if (view === "dia") {
    const dayStr = ymd(p.year, p.month, p.day);
    const touching = reservations.filter((r) => r.check_in_date <= dayStr && r.check_out_date >= dayStr);
    const arrivals = touching.filter((r) => r.check_in_date === dayStr).length;
    const departures = touching.filter((r) => r.check_out_date === dayStr && r.check_in_date !== dayStr).length;
    const occupied = touching.filter((r) => r.check_in_date <= dayStr && r.check_out_date > dayStr).length;
    const occPct = unitCount > 0 ? Math.round((occupied / unitCount) * 100) : 0;
    return [
      { label: "Chegadas", value: arrivals, icon: LogIn },
      { label: "Saídas", value: departures, icon: LogOut },
      { label: "Ocupados", value: occupied, icon: BedDouble },
      { label: "Ocupação do dia", value: `${occPct}%`, icon: Percent },
    ];
  }

  if (view === "ano") {
    const yearStart = `${p.year}-01-01`;
    const nextYearStart = `${p.year + 1}-01-01`;
    let bookedNights = 0;
    for (const r of reservations) {
      const s = r.check_in_date > yearStart ? r.check_in_date : yearStart;
      const e = r.check_out_date < nextYearStart ? r.check_out_date : nextYearStart;
      const n = daysBetween(s, e);
      if (n > 0) bookedNights += n;
    }
    const daysInYear = daysBetween(yearStart, nextYearStart);
    const capacity = Math.max(1, unitCount * daysInYear);
    const occupancy = Math.min(100, Math.round((bookedNights / capacity) * 100));
    return [
      { label: "Reservas no ano", value: reservations.length, icon: CalendarDays },
      { label: "Noites vendidas", value: bookedNights, icon: MoonStar },
      { label: "Ocupação média", value: `${occupancy}%`, icon: Percent },
      { label: "Imóveis", value: unitCount, icon: Home },
    ];
  }

  // lista | mes → month stats
  const monthStart = ymd(p.year, p.month, 1);
  const lastDay = daysInMonthOf(p.year, p.month);
  const monthEnd = ymd(p.year, p.month, lastDay);
  const nextMonthFirst = p.month === 12 ? `${p.year + 1}-01-01` : ymd(p.year, p.month + 1, 1);
  const checkIns = reservations.filter((r) => r.check_in_date >= monthStart && r.check_in_date <= monthEnd).length;
  const checkOuts = reservations.filter((r) => r.check_out_date >= monthStart && r.check_out_date <= monthEnd).length;
  let bookedNights = 0;
  for (const r of reservations) {
    const s = r.check_in_date > monthStart ? r.check_in_date : monthStart;
    const e = r.check_out_date < nextMonthFirst ? r.check_out_date : nextMonthFirst;
    const n = daysBetween(s, e);
    if (n > 0) bookedNights += n;
  }
  const capacity = Math.max(1, unitCount * lastDay);
  const occupancy = Math.min(100, Math.round((bookedNights / capacity) * 100));
  void blockCount;
  return [
    { label: "Reservas no mês", value: reservations.length, icon: CalendarDays },
    { label: "Check-ins", value: checkIns, icon: LogIn },
    { label: "Check-outs", value: checkOuts, icon: LogOut },
    { label: "Ocupação", value: `${occupancy}%`, icon: Percent },
  ];
}
