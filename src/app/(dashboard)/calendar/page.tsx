import { requireAuth } from "@/lib/auth";
import { getCalendarData } from "@/lib/db/queries/calendar";
import { CalendarGrid } from "@/components/calendar/calendar-grid";
import { MonthNav } from "@/components/calendar/month-nav";
import { CalendarDays, LogIn, LogOut, Percent } from "lucide-react";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ year?: string; month?: string }>;
}

function parseMonthParams(params: { year?: string; month?: string }) {
  const now = new Date();
  let year = parseInt(params.year || "", 10);
  let month = parseInt(params.month || "", 10);
  if (!Number.isFinite(year) || year < 2000 || year > 3000) year = now.getFullYear();
  if (!Number.isFinite(month) || month < 1 || month > 12) month = now.getMonth() + 1;
  const monthStart = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const monthEnd = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return { year, month, monthStart, monthEnd, daysInMonth: lastDay };
}

const DAY_MS = 24 * 60 * 60 * 1000;
function daysBetween(a: string, b: string) {
  return Math.round((new Date(b + "T00:00:00Z").getTime() - new Date(a + "T00:00:00Z").getTime()) / DAY_MS);
}

export default async function CalendarPage({ searchParams }: PageProps) {
  const user = await requireAuth();
  const params = await searchParams;
  const { year, month, monthStart, monthEnd, daysInMonth } = parseMonthParams(params);

  const windowStart = monthStart;
  const windowEnd = monthEnd;

  const data = await getCalendarData(user.company_id, windowStart, windowEnd);
  const visibleProps = data.properties.filter((p) => p.status !== "inactive");
  const propIds = new Set(visibleProps.map((p) => p.id));
  const reservations = data.reservations.filter((r) => propIds.has(r.property_id));
  const blocks = data.blocks.filter((b) => propIds.has(b.property_id));

  // ── Month summary stats ──
  const monthEndExclusive = `${year}-${String(month).padStart(2, "0")}-${String(daysInMonth).padStart(2, "0")}`;
  const nextMonthFirst = new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 10);
  void monthEndExclusive;

  const checkInsThisMonth = reservations.filter(
    (r) => r.check_in_date >= monthStart && r.check_in_date <= monthEnd
  ).length;
  const checkOutsThisMonth = reservations.filter(
    (r) => r.check_out_date >= monthStart && r.check_out_date <= monthEnd
  ).length;

  // occupancy = booked room-nights overlapping the month / (units × days)
  let bookedNights = 0;
  for (const r of reservations) {
    const start = r.check_in_date > monthStart ? r.check_in_date : monthStart;
    const end = r.check_out_date < nextMonthFirst ? r.check_out_date : nextMonthFirst;
    const n = daysBetween(start, end);
    if (n > 0) bookedNights += n;
  }
  const capacity = Math.max(1, visibleProps.length * daysInMonth);
  const occupancy = Math.min(100, Math.round((bookedNights / capacity) * 100));

  const stats = [
    { label: "Reservas no mês", value: reservations.length, icon: CalendarDays },
    { label: "Check-ins", value: checkInsThisMonth, icon: LogIn },
    { label: "Check-outs", value: checkOutsThisMonth, icon: LogOut },
    { label: "Ocupação", value: `${occupancy}%`, icon: Percent },
  ];

  return (
    <div className="space-y-5 lg:space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl lg:text-3xl text-gray-900">Agenda</h1>
        <p className="text-sm text-gray-500">Visão mensal de reservas e bloqueios por imóvel.</p>
      </div>

      {/* Month summary */}
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

      <MonthNav year={year} month={month} />

      <CalendarGrid
        monthStart={monthStart}
        daysInMonth={daysInMonth}
        properties={visibleProps}
        reservations={reservations}
        blocks={blocks}
      />

      <div className="text-xs text-gray-400">
        {reservations.length} reserva(s) e {blocks.length} bloqueio(s) neste mês · {visibleProps.length} imóvel(is).
      </div>
    </div>
  );
}
