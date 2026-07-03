"use client";

// Simulador — calendário mensal com o preço/noite resolvido pelo motor (Fase 4)

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { TooltipProvider, TooltipRoot, TooltipTrigger, TooltipContent } from "@/components/ui";
import { cn } from "@/lib/utils/cn";
import { api } from "@/lib/chat/utils";
import { toast } from "@/components/ui/use-toast";
import { formatCurrency } from "@/lib/utils/format";
import { DAY_LABELS, RULE_KIND_LABELS, type NightPrice } from "@/types/pricing";
import type { PropertyLite } from "@/components/pricing/pricing-shell";

const inputClass =
  "px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-400/15";

function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

interface PriceCalendarProps {
  properties: PropertyLite[];
}

export function PriceCalendar({ properties }: PriceCalendarProps) {
  const [propertyId, setPropertyId] = useState(properties[0]?.id ?? "");
  const [month, setMonth] = useState(currentMonth());
  const [days, setDays] = useState<NightPrice[]>([]);
  const [basePriceCents, setBasePriceCents] = useState(0);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!propertyId) return;
    setLoading(true);
    try {
      const data = await api<{ days: NightPrice[]; base_price_cents: number }>(
        `/api/pricing/calendar?property_id=${propertyId}&month=${month}`
      );
      setDays(data.days);
      setBasePriceCents(data.base_price_cents);
    } catch (e) {
      toast({ title: "Erro ao simular", description: e instanceof Error ? e.message : "", variant: "error" });
    } finally {
      setLoading(false);
    }
  }, [propertyId, month]);

  useEffect(() => {
    load();
  }, [load]);

  // offset do primeiro dia no grid (domingo = 0)
  const firstDayOffset = useMemo(() => {
    const [y, m] = month.split("-").map(Number);
    return new Date(y, m - 1, 1).getDay();
  }, [month]);

  if (properties.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/60 py-12 text-center text-sm text-gray-400">
        Cadastre um imóvel para simular preços.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={propertyId}
          onChange={(e) => setPropertyId(e.target.value)}
          className={cn(inputClass, "bg-white cursor-pointer min-w-[220px]")}
        >
          {properties.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} ({p.code})
            </option>
          ))}
        </select>

        <div className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white">
          <button
            type="button"
            onClick={() => setMonth((m) => shiftMonth(m, -1))}
            className="rounded-l-lg p-2 text-gray-500 transition-colors hover:bg-gray-50"
            aria-label="Mês anterior"
          >
            <ChevronLeft size={16} aria-hidden="true" />
          </button>
          <span className="min-w-[150px] text-center text-sm font-semibold capitalize text-gray-800">
            {monthLabel(month)}
          </span>
          <button
            type="button"
            onClick={() => setMonth((m) => shiftMonth(m, 1))}
            className="rounded-r-lg p-2 text-gray-500 transition-colors hover:bg-gray-50"
            aria-label="Próximo mês"
          >
            <ChevronRight size={16} aria-hidden="true" />
          </button>
        </div>

        <span className="text-xs text-gray-500">
          Preço-base: <strong className="font-mono">{formatCurrency(basePriceCents)}</strong>/noite
        </span>
        {loading && <Loader2 size={14} className="animate-spin text-gray-400" aria-hidden="true" />}
      </div>

      <TooltipProvider delayDuration={150}>
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white p-3 shadow-card">
          <div className="grid min-w-[560px] grid-cols-7 gap-1">
            {DAY_LABELS.map((label) => (
              <div
                key={label}
                className="py-1 text-center text-[11px] font-semibold uppercase tracking-wider text-gray-400"
              >
                {label}
              </div>
            ))}
            {Array.from({ length: firstDayOffset }).map((_, i) => (
              <div key={`empty-${i}`} />
            ))}
            {days.map((day) => {
              const changed = day.price_cents !== basePriceCents;
              const cell = (
                <div
                  className={cn(
                    "flex min-h-[64px] flex-col justify-between rounded-lg border p-1.5 text-left",
                    day.holiday_name
                      ? "border-brand-300 bg-brand-50"
                      : changed
                        ? "border-amber-200 bg-amber-50/60"
                        : "border-gray-100 bg-white"
                  )}
                >
                  <span className="text-[11px] font-semibold text-gray-500">
                    {Number(day.date.slice(8))}
                  </span>
                  <span
                    className={cn(
                      "font-mono text-[11px] font-semibold",
                      changed ? "text-brand-700" : "text-gray-600"
                    )}
                  >
                    {formatCurrency(day.price_cents)}
                  </span>
                </div>
              );
              if (day.applied.length === 0 && !day.holiday_name) {
                return <div key={day.date}>{cell}</div>;
              }
              return (
                <TooltipRoot key={day.date}>
                  <TooltipTrigger asChild>
                    <div className="cursor-help">{cell}</div>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-[220px]">
                    <div className="space-y-0.5 text-xs">
                      {day.holiday_name && <div className="font-semibold">🎉 {day.holiday_name}</div>}
                      {day.applied.map((a) => (
                        <div key={a.id}>
                          {RULE_KIND_LABELS[a.kind]}: {a.name}
                        </div>
                      ))}
                      {day.applied.length === 0 && <div>Sem regra — preço-base</div>}
                    </div>
                  </TooltipContent>
                </TooltipRoot>
              );
            })}
          </div>
        </div>
      </TooltipProvider>

      <div className="flex flex-wrap gap-4 text-[11px] text-gray-500">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-3 rounded border border-gray-200 bg-white" aria-hidden="true" /> Preço-base
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-3 rounded border border-amber-200 bg-amber-50" aria-hidden="true" /> Com regra
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-3 rounded border border-brand-300 bg-brand-50" aria-hidden="true" /> Feriado
        </span>
      </div>
    </div>
  );
}
