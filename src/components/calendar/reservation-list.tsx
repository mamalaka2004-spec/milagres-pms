import Link from "next/link";
import { Star, LogIn, ArrowRight, MoonStar } from "lucide-react";
import { RESERVATION_STATUSES } from "@/lib/utils/constants";
import { formatDateShort } from "@/lib/utils/format";
import { MONTH_NAMES, WEEKDAY_NAMES } from "@/lib/calendar/view";
import type { CalendarPropertyRow, CalendarReservation } from "@/lib/db/queries/calendar";
import type { Channel } from "@/types/database";

const CHANNEL_LABELS: Record<Channel, string> = {
  direct: "Direto",
  airbnb: "Airbnb",
  booking: "Booking",
  expedia: "Expedia",
  vrbo: "Vrbo",
  manual: "Manual",
  other: "Outro",
};

function dateGroupLabel(date: string): string {
  const d = new Date(date + "T00:00:00Z");
  const wd = WEEKDAY_NAMES[d.getUTCDay()];
  return `${wd.charAt(0).toUpperCase()}${wd.slice(1)}, ${d.getUTCDate()} de ${MONTH_NAMES[d.getUTCMonth()]}`;
}

export function ReservationList({
  reservations,
  properties,
}: {
  reservations: CalendarReservation[];
  properties: CalendarPropertyRow[];
}) {
  const propName = new Map(properties.map((p) => [p.id, p]));

  const sorted = [...reservations].sort((a, b) => {
    if (a.check_in_date !== b.check_in_date) return a.check_in_date < b.check_in_date ? -1 : 1;
    return (propName.get(a.property_id)?.name || "").localeCompare(propName.get(b.property_id)?.name || "");
  });

  // group by check-in date
  const groups: { date: string; items: CalendarReservation[] }[] = [];
  for (const r of sorted) {
    const last = groups[groups.length - 1];
    if (last && last.date === r.check_in_date) last.items.push(r);
    else groups.push({ date: r.check_in_date, items: [r] });
  }

  if (reservations.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-6 py-16 text-center text-sm text-gray-400">
        Nenhuma reserva neste período.
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden divide-y divide-gray-100">
      {groups.map((g) => (
        <div key={g.date}>
          <div className="sticky top-0 z-10 bg-gray-50/95 backdrop-blur px-4 py-2 text-xs font-semibold text-gray-500 border-b border-gray-100 flex items-center gap-2">
            <LogIn size={13} className="text-brand-500" aria-hidden="true" />
            <span className="capitalize">{dateGroupLabel(g.date)}</span>
            <span className="ml-auto text-gray-400 font-normal">{g.items.length} chegada(s)</span>
          </div>
          <div className="divide-y divide-gray-50">
            {g.items.map((r) => {
              const cfg = RESERVATION_STATUSES[r.status];
              const prop = propName.get(r.property_id);
              return (
                <Link
                  key={r.id}
                  href={`/reservations/${r.id}`}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-brand-50/40 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/30"
                >
                  <div className="w-9 h-9 rounded-lg shrink-0 bg-brand-500/10 text-brand-600 flex items-center justify-center text-sm font-bold overflow-hidden">
                    {prop?.cover_image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={prop.cover_image_url} alt="" loading="lazy" className="w-full h-full object-cover" />
                    ) : (
                      (prop?.name || "?").charAt(0).toUpperCase()
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      {r.is_vip && <Star size={12} fill="currentColor" className="text-amber-500 shrink-0" aria-hidden="true" />}
                      <span className="font-semibold text-sm text-gray-900 truncate">{r.guest_name}</span>
                    </div>
                    <div className="text-xs text-gray-500 truncate">
                      {prop?.name || "—"} · <span className="font-mono text-gray-400">{r.booking_code}</span>
                    </div>
                  </div>
                  <div className="hidden sm:flex items-center gap-1.5 text-xs text-gray-500 tabular-nums shrink-0">
                    <span>{formatDateShort(r.check_in_date)}</span>
                    <ArrowRight size={12} className="text-gray-300" aria-hidden="true" />
                    <span>{formatDateShort(r.check_out_date)}</span>
                    <span className="inline-flex items-center gap-0.5 text-gray-400 ml-1">
                      <MoonStar size={11} aria-hidden="true" />
                      {r.nights}
                    </span>
                  </div>
                  <span className="hidden md:inline text-[10px] font-medium text-gray-400 shrink-0 w-14 text-right">
                    {CHANNEL_LABELS[r.channel]}
                  </span>
                  <span
                    className="text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0"
                    style={{ backgroundColor: cfg.bgColor, color: cfg.color }}
                  >
                    {cfg.label}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
