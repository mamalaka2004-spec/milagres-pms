"use client";

import Link from "next/link";
import { useMemo, useRef, useState, useEffect } from "react";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { RESERVATION_STATUSES } from "@/lib/utils/constants";
import type {
  CalendarBlock,
  CalendarPropertyRow,
  CalendarReservation,
} from "@/lib/db/queries/calendar";

interface CalendarGridProps {
  monthStart: string; // YYYY-MM-01
  daysInMonth: number;
  properties: CalendarPropertyRow[];
  reservations: CalendarReservation[];
  blocks: CalendarBlock[];
}

const MIN_DAY_PX = 40; // floor — below this the grid scrolls horizontally
const ROW_HEIGHT_PX = 72;
const WEEKDAY_LABELS = ["D", "S", "T", "Q", "Q", "S", "S"];

/**
 * Compute the column index (0-based, day-of-month - 1) and span for a date range
 * relative to the visible month. Clamps to the visible window.
 */
function computeRangePosition(
  startDate: string,
  endDate: string,
  monthStart: string,
  daysInMonth: number
): { colStart: number; span: number } | null {
  const monthStartDate = new Date(monthStart + "T00:00:00Z");
  const monthEndDate = new Date(monthStartDate);
  monthEndDate.setUTCDate(monthEndDate.getUTCDate() + daysInMonth);

  const start = new Date(startDate + "T00:00:00Z");
  const end = new Date(endDate + "T00:00:00Z");

  if (end <= monthStartDate) return null;
  if (start >= monthEndDate) return null;

  const visibleStart = start < monthStartDate ? monthStartDate : start;
  const visibleEnd = end > monthEndDate ? monthEndDate : end;

  const colStart = Math.floor(
    (visibleStart.getTime() - monthStartDate.getTime()) / (24 * 60 * 60 * 1000)
  );
  const span = Math.ceil(
    (visibleEnd.getTime() - visibleStart.getTime()) / (24 * 60 * 60 * 1000)
  );

  if (span <= 0) return null;
  return { colStart, span };
}

export function CalendarGrid({
  monthStart,
  daysInMonth,
  properties,
  reservations,
  blocks,
}: CalendarGridProps) {
  const today = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }, []);

  // Responsive sizing: the day columns grow to fill the available width (no wasted
  // space on the right), and only scroll horizontally when they'd be narrower than
  // MIN_DAY_PX. This is what makes the Agenda "fill the side space" on wide screens.
  const scrollRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ dayWidth: MIN_DAY_PX, propCol: 240 });
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const recompute = () => {
      const w = el.clientWidth;
      const propCol = w < 560 ? 132 : w < 900 ? 184 : 240;
      const dayWidth = Math.max(MIN_DAY_PX, Math.floor((w - propCol) / daysInMonth));
      setDims({ dayWidth, propCol });
    };
    recompute();
    const ro = new ResizeObserver(recompute);
    ro.observe(el);
    return () => ro.disconnect();
  }, [daysInMonth]);

  const { dayWidth, propCol } = dims;
  const monthStartDate = new Date(monthStart + "T00:00:00Z");
  const days = Array.from({ length: daysInMonth }, (_, i) => {
    const d = new Date(monthStartDate);
    d.setUTCDate(d.getUTCDate() + i);
    return {
      date: d.toISOString().split("T")[0],
      day: d.getUTCDate(),
      weekday: d.getUTCDay(),
    };
  });

  const reservationsByProperty = new Map<string, CalendarReservation[]>();
  for (const r of reservations) {
    const arr = reservationsByProperty.get(r.property_id) || [];
    arr.push(r);
    reservationsByProperty.set(r.property_id, arr);
  }
  const blocksByProperty = new Map<string, CalendarBlock[]>();
  for (const b of blocks) {
    const arr = blocksByProperty.get(b.property_id) || [];
    arr.push(b);
    blocksByProperty.set(b.property_id, arr);
  }

  const templateColumns = `${propCol}px repeat(${daysInMonth}, ${dayWidth}px)`;
  const innerMinWidth = propCol + daysInMonth * dayWidth;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      <div ref={scrollRef} className="overflow-x-auto" style={{ scrollbarWidth: "thin" }}>
        <div style={{ minWidth: `${innerMinWidth}px` }}>
          {/* Header: weekday + day number */}
          <div
            className="grid sticky top-0 z-20 bg-white/95 backdrop-blur border-b border-gray-200"
            style={{ gridTemplateColumns: templateColumns }}
          >
            <div className="sticky left-0 z-10 bg-white/95 backdrop-blur px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-gray-400 border-r border-gray-200">
              Imóvel
            </div>
            {days.map((d) => {
              const isWeekend = d.weekday === 0 || d.weekday === 6;
              const isToday = d.date === today;
              return (
                <div
                  key={d.date}
                  className={cn(
                    "py-1.5 text-center border-l border-gray-100 leading-tight",
                    isWeekend ? "bg-gray-50 text-gray-400" : "text-gray-500",
                    isToday && "bg-brand-100"
                  )}
                >
                  <div className="text-[9px] uppercase tracking-wide">
                    {WEEKDAY_LABELS[d.weekday]}
                  </div>
                  <div
                    className={cn(
                      "text-xs font-semibold tabular-nums",
                      isToday ? "text-brand-700" : "text-gray-700"
                    )}
                  >
                    {d.day}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Rows */}
          {properties.map((property) => {
            const reservationsHere = reservationsByProperty.get(property.id) || [];
            const blocksHere = blocksByProperty.get(property.id) || [];

            return (
              <div
                key={property.id}
                className="grid border-b border-gray-100 hover:bg-brand-50/30 transition-colors relative group"
                style={{ gridTemplateColumns: templateColumns, height: `${ROW_HEIGHT_PX}px` }}
              >
                {/* Property label — sticky to the left while scrolling */}
                <Link
                  href={`/properties/${property.id}`}
                  className="sticky left-0 z-10 bg-white group-hover:bg-brand-50/60 px-3 flex items-center gap-3 border-r border-gray-200 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40"
                >
                  {property.cover_image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={property.cover_image_url}
                      alt=""
                      loading="lazy"
                      className="w-10 h-10 rounded-lg object-cover shrink-0 border border-gray-200"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-lg shrink-0 bg-brand-500/10 text-brand-600 flex items-center justify-center text-sm font-bold">
                      {property.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="font-semibold text-sm text-gray-900 truncate leading-tight">
                      {property.name}
                    </div>
                    <div className="text-[10px] font-mono text-gray-400 truncate">
                      {property.code}
                    </div>
                  </div>
                </Link>

                {/* Day cells (background) */}
                {days.map((d) => {
                  const isWeekend = d.weekday === 0 || d.weekday === 6;
                  const isToday = d.date === today;
                  return (
                    <div
                      key={d.date}
                      className={cn(
                        "border-l border-gray-100 relative",
                        isWeekend && "bg-gray-50/50",
                        isToday && "bg-brand-100/25"
                      )}
                    />
                  );
                })}

                {/* Block bars */}
                {blocksHere.map((b) => {
                  const pos = computeRangePosition(b.start_date, b.end_date, monthStart, daysInMonth);
                  if (!pos) return null;
                  const sourceColor =
                    b.external_source === "airbnb" ? "#FF5A5F"
                    : b.external_source === "booking" ? "#003580"
                    : "#94a3b8";
                  return (
                    <div
                      key={b.id}
                      className="absolute top-2 bottom-2 rounded-md text-[10px] font-semibold px-2 flex items-center text-white shadow-sm overflow-hidden"
                      style={{
                        left: `${propCol + pos.colStart * dayWidth + 2}px`,
                        width: `${pos.span * dayWidth - 4}px`,
                        background:
                          b.external_source && b.external_source !== "manual"
                            ? `repeating-linear-gradient(45deg, ${sourceColor}, ${sourceColor} 4px, ${sourceColor}cc 4px, ${sourceColor}cc 8px)`
                            : "repeating-linear-gradient(45deg, #94a3b8, #94a3b8 4px, #cbd5e1 4px, #cbd5e1 8px)",
                      }}
                      title={`${b.external_source || "manual"}: ${b.external_summary || b.reason || "bloqueado"}`}
                    >
                      <span className="truncate">
                        {b.external_source === "airbnb" ? "Airbnb" : b.external_source === "booking" ? "Booking" : "Bloqueio"}
                      </span>
                    </div>
                  );
                })}

                {/* Reservation bars */}
                {reservationsHere.map((r) => {
                  const pos = computeRangePosition(r.check_in_date, r.check_out_date, monthStart, daysInMonth);
                  if (!pos) return null;
                  const cfg = RESERVATION_STATUSES[r.status];
                  const wide = pos.span * dayWidth > 70;
                  return (
                    <Link
                      key={r.id}
                      href={`/reservations/${r.id}`}
                      className="absolute top-2.5 bottom-2.5 rounded-lg flex items-center px-2 text-[11px] font-semibold shadow-sm hover:shadow-md hover:brightness-[0.97] transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/50 overflow-hidden gap-1"
                      style={{
                        left: `${propCol + pos.colStart * dayWidth + dayWidth / 2}px`,
                        width: `${pos.span * dayWidth - dayWidth}px`,
                        backgroundColor: cfg.bgColor,
                        color: cfg.color,
                        zIndex: 2,
                      }}
                      title={`${r.booking_code} · ${r.guest_name} · ${cfg.label} · ${r.nights} noite(s)`}
                    >
                      {r.is_vip && <Star size={11} fill="currentColor" className="shrink-0" aria-hidden="true" />}
                      <span className="truncate">{r.guest_name}</span>
                      {wide && (
                        <span className="ml-auto shrink-0 opacity-70 tabular-nums">{r.nights}n</span>
                      )}
                    </Link>
                  );
                })}
              </div>
            );
          })}

          {properties.length === 0 && (
            <div className="px-6 py-16 text-center text-sm text-gray-400">
              Nenhum imóvel ainda — cadastre um para começar a usar a Agenda.
            </div>
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 border-t border-gray-100 bg-gray-50/70 text-[11px]">
        <Legend label="Confirmada" color={RESERVATION_STATUSES.confirmed.bgColor} textColor={RESERVATION_STATUSES.confirmed.color} />
        <Legend label="Pendente" color={RESERVATION_STATUSES.pending.bgColor} textColor={RESERVATION_STATUSES.pending.color} />
        <Legend label="Hospedado" color={RESERVATION_STATUSES.checked_in.bgColor} textColor={RESERVATION_STATUSES.checked_in.color} />
        <LegendStripes label="Airbnb" colorA="#FF5A5F" colorB="#FF8A8F" />
        <LegendStripes label="Booking" colorA="#003580" colorB="#3380aa" />
        <LegendStripes label="Bloqueio" colorA="#94a3b8" colorB="#cbd5e1" />
      </div>
    </div>
  );
}

function Legend({ label, color, textColor }: { label: string; color: string; textColor: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="inline-block w-3 h-3 rounded" style={{ backgroundColor: color, border: `1px solid ${textColor}33` }} />
      <span className="text-gray-600">{label}</span>
    </div>
  );
}

function LegendStripes({ label, colorA, colorB }: { label: string; colorA: string; colorB: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span
        className="inline-block w-3 h-3 rounded"
        style={{ background: `repeating-linear-gradient(45deg, ${colorA}, ${colorA} 2px, ${colorB} 2px, ${colorB} 4px)` }}
      />
      <span className="text-gray-600">{label}</span>
    </div>
  );
}
