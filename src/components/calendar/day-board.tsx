import Link from "next/link";
import { Star, LogIn, LogOut, BedDouble, Ban, Home } from "lucide-react";
import { formatDateShort } from "@/lib/utils/format";
import { StatusBadge, EntityAvatar } from "@/components/ui";
import type { CalendarBlock, CalendarPropertyRow, CalendarReservation } from "@/lib/db/queries/calendar";

interface DayBoardProps {
  day: string; // YYYY-MM-DD
  reservations: CalendarReservation[];
  blocks: CalendarBlock[];
  properties: CalendarPropertyRow[];
}

export function DayBoard({ day, reservations, blocks, properties }: DayBoardProps) {
  const propMap = new Map(properties.map((p) => [p.id, p]));

  // reservations touching `day` (check_in <= day <= check_out)
  const touching = reservations.filter((r) => r.check_in_date <= day && r.check_out_date >= day);
  const arrivals = touching.filter((r) => r.check_in_date === day);
  const departures = touching.filter((r) => r.check_out_date === day && r.check_in_date !== day);
  const inhouse = touching.filter((r) => r.check_in_date < day && r.check_out_date > day);

  // blocks covering `day` (end is checkout-style / exclusive)
  const blockedHere = blocks.filter((b) => b.start_date <= day && b.end_date > day);

  // free properties = no arrival, in-house stay, or block today
  const busyPropIds = new Set<string>([
    ...touching.map((r) => r.property_id),
    ...blockedHere.map((b) => b.property_id),
  ]);
  const freeCount = properties.filter((p) => !busyPropIds.has(p.id)).length;

  const isEmpty =
    arrivals.length === 0 && departures.length === 0 && inhouse.length === 0 && blockedHere.length === 0;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <Section title="Chegadas" icon={LogIn} accent="text-emerald-600" count={arrivals.length}>
          {arrivals.map((r) => (
            <ReservationRow key={r.id} r={r} prop={propMap.get(r.property_id)} tag="check-in" />
          ))}
          {arrivals.length === 0 && <Empty>Sem chegadas neste dia.</Empty>}
        </Section>

        <Section title="Saídas" icon={LogOut} accent="text-orange-600" count={departures.length}>
          {departures.map((r) => (
            <ReservationRow key={r.id} r={r} prop={propMap.get(r.property_id)} tag="check-out" />
          ))}
          {departures.length === 0 && <Empty>Sem saídas neste dia.</Empty>}
        </Section>

        <Section title="Hospedados" icon={BedDouble} accent="text-blue-600" count={inhouse.length}>
          {inhouse.map((r) => (
            <ReservationRow key={r.id} r={r} prop={propMap.get(r.property_id)} />
          ))}
          {inhouse.length === 0 && <Empty>Ninguém hospedado neste dia.</Empty>}
        </Section>

        <Section title="Bloqueios" icon={Ban} accent="text-gray-500" count={blockedHere.length}>
          {blockedHere.map((b) => {
            const prop = propMap.get(b.property_id);
            const src =
              b.external_source === "airbnb" ? "Airbnb"
              : b.external_source === "booking" ? "Booking"
              : "Manual";
            return (
              <div key={b.id} className="flex items-center gap-3 px-4 py-3">
                <div className="w-9 h-9 rounded-lg shrink-0 bg-gray-100 text-gray-400 flex items-center justify-center">
                  <Ban size={16} aria-hidden="true" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-sm text-gray-900 truncate">{prop?.name || "—"}</div>
                  <div className="text-xs text-gray-500 truncate">{b.external_summary || b.reason || "Bloqueado"}</div>
                </div>
                <span className="text-[10px] font-medium text-gray-400 shrink-0">{src}</span>
              </div>
            );
          })}
          {blockedHere.length === 0 && <Empty>Nenhum bloqueio neste dia.</Empty>}
        </Section>
      </div>

      <div className="flex items-center gap-2 text-sm text-gray-500 px-1">
        <Home size={14} className="text-brand-500" aria-hidden="true" />
        <span>
          <span className="font-semibold text-gray-700 tabular-nums">{freeCount}</span> imóvel(is) livre(s) em {formatDateShort(day)} · {properties.length} no total.
        </span>
      </div>

      {isEmpty && properties.length > 0 && (
        <div className="text-xs text-gray-400 px-1">Nenhuma movimentação registrada neste dia.</div>
      )}
    </div>
  );
}

function Section({
  title,
  icon: Icon,
  accent,
  count,
  children,
}: {
  title: string;
  icon: typeof LogIn;
  accent: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-card overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
        <Icon size={16} className={accent} aria-hidden="true" />
        <span className="font-semibold text-sm text-gray-800">{title}</span>
        <span className="ml-auto text-xs font-semibold text-gray-400 tabular-nums">{count}</span>
      </div>
      <div className="divide-y divide-gray-50">{children}</div>
    </div>
  );
}

function ReservationRow({
  r,
  prop,
  tag,
}: {
  r: CalendarReservation;
  prop?: CalendarPropertyRow;
  tag?: "check-in" | "check-out";
}) {
  return (
    <Link
      href={`/reservations/${r.id}`}
      className="flex items-center gap-3 px-4 py-3 hover:bg-brand-50/40 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/30 focus-visible:ring-inset"
    >
      <EntityAvatar src={prop?.cover_image_url} name={prop?.name} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          {r.is_vip && <Star size={12} fill="currentColor" className="text-amber-500 shrink-0" aria-hidden="true" />}
          <span className="font-semibold text-sm text-gray-900 truncate">{r.guest_name}</span>
        </div>
        <div className="text-xs text-gray-500 truncate">
          {prop?.name || "—"} · {r.nights} noite(s)
        </div>
      </div>
      {tag && (
        <span className="hidden sm:inline text-[10px] font-semibold uppercase tracking-wide text-gray-400 shrink-0">
          {tag === "check-in" ? "Chegada" : "Saída"}
        </span>
      )}
      <StatusBadge type="reservation" value={r.status} className="shrink-0" />
    </Link>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="px-4 py-6 text-center text-xs text-gray-400">{children}</div>;
}
