"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { RESERVATION_STATUSES } from "@/lib/utils/constants";
import { formatCurrency } from "@/lib/utils/format";
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

const DAY_WIDTH_PX = 44;
const ROW_HEIGHT_PX = 64;

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

  // No overlap?
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

  const monthStartDate = new Date(monthStart + "T00:00:00Z");
  const days = Array.from({ length: daysInMonth }, (_, i) => {
    const d = new Date(monthStartDate);
    d.setUTCDate(d.getUTCDate() + i);
    return {
      date: d.toISOString().split("T")[0],
      day: d.getUTCDate(),
      weekday: d.getUTCDay(), // 0=Sun, 6=Sat
    };
  });

  // Group reservations + blocks by property
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

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div
        className="overflow-x-auto"
        style={{ scrollbarWidth: "thin" }}
      >
        <div
          style={{
            minWidth: `${200 + daysInMonth * DAY_WIDTH_PX}px`,
          }}
        >
          {/* Header: day numbers */}
          <div
            className="grid sticky top-0 z-10 bg-white border-b border-gray-200"
            style={{
              gridTemplateColumns: `200px repeat(${daysInMonth}, ${DAY_WIDTH_PX}px)`,
            }}
          >
            <div className="px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-gray-400">
              Property
            </div>
            {days.map((d) => {
              const isWeekend = d.weekday === 0 || d.weekday === 6;
              const isToday = d.date === today;
              return (
                <div
                  key={d.date}
                  className={cn(
                    "py-1 text-center text-[11px] font-mono border-l border-gray-100",
                    isWeekend ? "bg-gray-50 text-gray-500" : "text-gray-600",
                    isToday && "bg-brand-100 text-brand-700 font-bold"
                  )}
                >
                  {d.day}
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
                className="grid border-b border-gray-100 hover:bg-gray-50/50 transition-colors relative"
                style={{
                  gridTemplateColumns: `200px repeat(${daysInMonth}, ${DAY_WIDTH_PX}px)`,
                  height: `${ROW_HEIGHT_PX}px`,
                }}
              >
                {/* Property label */}
                <Link
                  href={`/properties/${property.id}`}
                  className="px-3 py-2 flex flex-col justify-center border-r border-gray-200 hover:bg-gray-100"
                >
                  <div className="font-semibold text-sm text-gray-900 truncate">
                    {property.name}
                  </div>
                  <div className="text-[10px] font-mono text-gray-400">
                    {property.code}
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
                        isWeekend && "bg-gray-50/40",
                        isToday && "bg-brand-100/30"
                      )}
                    />
                  );
                })}

                {/* Block bars (rendered first so reservations overlay them) */}
                {blocksHere.map((b) => {
                  const pos = computeRangePosition(
                    b.start_date,
                    b.end_date,
                    monthStart,
                    daysInMonth
                  );
                  if (!pos) return null;
                  const sourceColor =
                    b.external_source === "airbnb"
                      ? "#FF5A5F"
                      : b.external_source === "booking"
                      ? "#003580"
                      : "#94a3b8";
                  return (
                    <div
                      key={b.id}
                      className="absolute top-1 bottom-1 rounded text-[10px] font-semibold px-2 flex items-center text-white shadow-sm overflow-hidden"
                      style={{
                        left: `calc(200px + ${pos.colStart * DAY_WIDTH_PX}px + 2px)`,
                        width: `${pos.span * DAY_WIDTH_PX - 4}px`,
                        background:
                          b.external_source && b.external_source !== "manual"
                            ? `repeating-linear-gradient(45deg, ${sourceColor}, ${sourceColor} 4px, ${sourceColor}cc 4px, ${sourceColor}cc 8px)`
                            : "repeating-linear-gradient(45deg, #94a3b8, #94a3b8 4px, #cbd5e1 4px, #cbd5e1 8px)",
                      }}
                      title={`${b.external_source || "manual"}: ${b.external_summary || b.reason || "blocked"}`}
                    >
                      <span className="truncate">
                        {b.external_source === "airbnb"
                          ? "Airbnb"
                          : b.external_source === "booking"
                          ? "Booking"
                          : "Block"}
                      </span>
                    </div>
                  );
                })}

                {/* Reservation bars */}
                {reservationsHere.map((r) => {
                  const pos = computeRangePosition(
                    r.check_in_date,
                    r.check_out_date,
                    monthStart,
                    daysInMonth
                  );
                  if (!pos) return null;
                  const cfg = RESERVATION_STATUSES[r.status];
                  return (
                    <Link
                      key={r.id}
                      href={`/reservations/${r.id}`}
                      className="absolute top-2 bottom-2 rounded-md flex items-center px-2 text-[11px] font-semibold shadow-sm hover:shadow-md hover:scale-y-105 transition overflow-hidden gap-1"
                      style={{
                        left: `calc(200px + ${pos.colStart * DAY_WIDTH_PX}px + ${DAY_WIDTH_PX / 2}px)`,
                        width: `${pos.span * DAY_WIDTH_PX - DAY_WIDTH_PX}px`,
                        backgroundColor: cfg.bgColor,
                        color: cfg.color,
                        zIndex: 2,
                      }}
                      title={`${r.booking_code} · ${r.guest_name} · ${cfg.label}`}
                    >
                      {r.is_vip && <Star size={10} fill="currentColor" />}
                      <span className="truncate">{r.guest_name}</span>
                    </Link>
                  );
                })}
              </div>
            );
          })}

          {properties.length === 0 && (
            <div className="px-6 py-12 text-center text-sm text-gray-400">
              No properties yet — add one to start using the calendar.
            </div>
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 px-4 py-2 border-t border-gray-100 bg-gray-50 text-[11px]">
        <Legend label="Confirmed" color={RESERVATION_STATUSES.confirmed.bgColor} textColor={RESERVATION_STATUSES.confirmed.color} />
        <Legend label="Pending" color={RESERVATION_STATUSES.pending.bgColor} textColor={RESERVATION_STATUSES.pending.color} />
        <Legend label="Checked In" color={RESERVATION_STATUSES.checked_in.bgColor} textColor={RESERVATION_STATUSES.checked_in.color} />
        <LegendStripes label="Airbnb sync" colorA="#FF5A5F" colorB="#FF8A8F" />
        <LegendStripes label="Booking sync" colorA="#003580" colorB="#3380aa" />
        <LegendStripes label="Manual block" colorA="#94a3b8" colorB="#cbd5e1" />
      </div>
    </div>
  );
}

function Legend({ label, color, textColor }: { label: string; color: string; textColor: string }) {
  return (
    <div className="flex items-center gap-1">
      <span
        className="inline-block w-3 h-3 rounded"
        style={{ backgroundColor: color, border: `1px solid ${textColor}33` }}
      />
      <span className="text-gray-600">{label}</span>
    </div>
  );
}

function LegendStripes({ label, colorA, colorB }: { label: string; colorA: string; colorB: string }) {
  return (
    <div className="flex items-center gap-1">
      <span
        className="inline-block w-3 h-3 rounded"
        style={{
          background: `repeating-linear-gradient(45deg, ${colorA}, ${colorA} 2px, ${colorB} 2px, ${colorB} 4px)`,
        }}
      />
      <span className="text-gray-600">{label}</span>
    </div>
  );
}
