import { requireAuth } from "@/lib/auth";
import { getCalendarData } from "@/lib/db/queries/calendar";
import { CalendarGrid } from "@/components/calendar/calendar-grid";
import { MonthNav } from "@/components/calendar/month-nav";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ year?: string; month?: string }>;
}

function parseMonthParams(params: { year?: string; month?: string }) {
  const now = new Date();
  let year = parseInt(params.year || "", 10);
  let month = parseInt(params.month || "", 10);
  if (!Number.isFinite(year) || year < 2000 || year > 3000) {
    year = now.getFullYear();
  }
  if (!Number.isFinite(month) || month < 1 || month > 12) {
    month = now.getMonth() + 1;
  }
  const monthStart = `${year}-${String(month).padStart(2, "0")}-01`;
  // last day of month
  const lastDay = new Date(year, month, 0).getDate();
  const monthEnd = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return { year, month, monthStart, monthEnd, daysInMonth: lastDay };
}

export default async function CalendarPage({ searchParams }: PageProps) {
  const user = await requireAuth();
  const params = await searchParams;
  const { year, month, monthStart, monthEnd, daysInMonth } = parseMonthParams(params);

  // Pull a window slightly larger than the visible month so reservations
  // that span across month boundaries can still be clipped/positioned.
  const windowStart = monthStart;
  const windowEnd = `${year}-${String(month).padStart(2, "0")}-${String(daysInMonth).padStart(2, "0")}`;

  const data = await getCalendarData(user.company_id, windowStart, windowEnd);
  // Filter properties to active ones for cleaner display
  const visibleProps = data.properties.filter((p) => p.status !== "inactive");

  void monthEnd; // referenced for symmetry / future range queries

  return (
    <div className="space-y-4 lg:space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-xl lg:text-2xl font-bold text-gray-900">Calendar</h1>
      </div>

      <MonthNav year={year} month={month} />

      <CalendarGrid
        monthStart={monthStart}
        daysInMonth={daysInMonth}
        properties={visibleProps}
        reservations={data.reservations.filter((r) =>
          visibleProps.some((p) => p.id === r.property_id)
        )}
        blocks={data.blocks.filter((b) =>
          visibleProps.some((p) => p.id === b.property_id)
        )}
      />

      <div className="text-xs text-gray-500">
        Mostrando {data.reservations.length} reservas e {data.blocks.length} bloqueios neste mês.
      </div>
    </div>
  );
}
