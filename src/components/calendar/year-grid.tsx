import Link from "next/link";
import { cn } from "@/lib/utils/cn";
import {
  calendarHref,
  daysBetween,
  daysInMonthOf,
  ymd,
  MONTH_NAMES,
  MONTH_NAMES_SHORT,
} from "@/lib/calendar/view";
import type { CalendarReservation, CalendarPropertyRow } from "@/lib/db/queries/calendar";

const BRAND = "74, 90, 64"; // brand-600 #4A5A40 → rgb for heat alpha

/** Booked nights of a reservation that fall inside [monthStart, nextMonthStart). */
function nightsInMonth(r: CalendarReservation, year: number, month: number): number {
  const monthStart = ymd(year, month, 1);
  const nextMonthStart = month === 12 ? `${year + 1}-01-01` : ymd(year, month + 1, 1);
  const start = r.check_in_date > monthStart ? r.check_in_date : monthStart;
  const end = r.check_out_date < nextMonthStart ? r.check_out_date : nextMonthStart;
  const n = daysBetween(start, end);
  return n > 0 ? n : 0;
}

export function YearGrid({
  year,
  reservations,
  properties,
}: {
  year: number;
  reservations: CalendarReservation[];
  properties: CalendarPropertyRow[];
}) {
  // matrix[propId][monthIndex 0..11] = booked nights
  const matrix = new Map<string, number[]>();
  for (const p of properties) matrix.set(p.id, new Array(12).fill(0));
  for (const r of reservations) {
    const row = matrix.get(r.property_id);
    if (!row) continue;
    for (let m = 1; m <= 12; m++) row[m - 1] += nightsInMonth(r, year, m);
  }

  const capacities = Array.from({ length: 12 }, (_, i) => daysInMonthOf(year, i + 1));
  const today = new Date();
  const currentMonthIdx =
    today.getFullYear() === year ? today.getMonth() : -1;

  if (properties.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-6 py-16 text-center text-sm text-gray-400">
        Nenhum imóvel ainda — cadastre um para começar a usar a Agenda.
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="overflow-x-auto" style={{ scrollbarWidth: "thin" }}>
        <table className="w-full border-collapse" style={{ minWidth: "760px" }}>
          <thead>
            <tr className="border-b border-gray-200">
              <th className="sticky left-0 z-10 bg-white text-left px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-gray-400 border-r border-gray-200">
                Imóvel
              </th>
              {MONTH_NAMES_SHORT.map((m, i) => (
                <th
                  key={m}
                  className={cn(
                    "px-1 py-2.5 text-center text-[11px] font-semibold",
                    i === currentMonthIdx ? "text-brand-700 bg-brand-50" : "text-gray-500"
                  )}
                >
                  {m}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {properties.map((p) => {
              const row = matrix.get(p.id) || [];
              return (
                <tr key={p.id} className="border-b border-gray-100 last:border-0 group">
                  <td className="sticky left-0 z-10 bg-white group-hover:bg-brand-50/40 transition-colors border-r border-gray-200 px-3 py-2">
                    <Link href={`/properties/${p.id}`} className="flex items-center gap-2.5 min-w-0">
                      {p.cover_image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.cover_image_url} alt="" loading="lazy" className="w-8 h-8 rounded-md object-cover shrink-0 border border-gray-200" />
                      ) : (
                        <div className="w-8 h-8 rounded-md shrink-0 bg-brand-500/10 text-brand-600 flex items-center justify-center text-xs font-bold">
                          {p.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="font-semibold text-[13px] text-gray-900 truncate leading-tight max-w-[150px]">{p.name}</div>
                        <div className="text-[10px] font-mono text-gray-400 truncate">{p.code}</div>
                      </div>
                    </Link>
                  </td>
                  {row.map((nights, mi) => {
                    const cap = capacities[mi];
                    const occ = cap > 0 ? Math.min(1, nights / cap) : 0;
                    const pct = Math.round(occ * 100);
                    const alpha = occ === 0 ? 0 : 0.12 + occ * 0.78;
                    return (
                      <td key={mi} className="p-0.5 text-center">
                        <Link
                          href={calendarHref({ view: "mes", year, month: mi + 1, day: 1 })}
                          title={`${p.name} · ${MONTH_NAMES[mi]} ${year} · ${pct}% (${nights} noite(s))`}
                          className="flex items-center justify-center h-9 rounded-md text-[11px] font-semibold tabular-nums transition-transform duration-150 hover:scale-[1.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40"
                          style={{
                            backgroundColor: occ === 0 ? "#f9fafb" : `rgba(${BRAND}, ${alpha})`,
                            color: occ > 0.55 ? "#fff" : occ === 0 ? "#cbd5e1" : "#3A4832",
                          }}
                        >
                          {pct === 0 ? "·" : `${pct}%`}
                        </Link>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center gap-3 px-4 py-3 border-t border-gray-100 bg-gray-50/70 text-[11px] text-gray-500">
        <span>Ocupação por mês:</span>
        <div className="flex items-center gap-1">
          {[0, 25, 50, 75, 100].map((p) => (
            <span
              key={p}
              className="inline-block w-5 h-3.5 rounded-sm"
              style={{ backgroundColor: p === 0 ? "#f9fafb" : `rgba(${BRAND}, ${0.12 + (p / 100) * 0.78})` }}
              title={`${p}%`}
            />
          ))}
        </div>
        <span className="text-gray-400">0% → 100% · clique numa célula para abrir o mês.</span>
      </div>
    </div>
  );
}
