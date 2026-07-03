"use client";

// Tarifa sugerida (Análise de Mercado) — aplicar em lote (Fase 4)
// Modo "base": sobrescreve o preço-base dos imóveis selecionados.
// Modo "season": cria uma regra de temporada (preço fixo) por imóvel.

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, TrendingDown, TrendingUp, Minus, ExternalLink } from "lucide-react";
import Link from "next/link";
import { Button, ConfirmDialog } from "@/components/ui";
import { cn } from "@/lib/utils/cn";
import { api } from "@/lib/chat/utils";
import { toast } from "@/components/ui/use-toast";
import { formatCurrency } from "@/lib/utils/format";
import type { PropertySuggestion } from "@/types/pricing";

const inputClass =
  "px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-400/15";

type ApplyMode = "base" | "season";

interface SuggestionsTabProps {
  onApplied: () => Promise<void> | void;
}

export function SuggestionsTab({ onApplied }: SuggestionsTabProps) {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<PropertySuggestion[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [prices, setPrices] = useState<Record<string, string>>({}); // property_id → R$ editável
  const [mode, setMode] = useState<ApplyMode>("base");
  const [seasonName, setSeasonName] = useState("");
  const [seasonStart, setSeasonStart] = useState("");
  const [seasonEnd, setSeasonEnd] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [applying, setApplying] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api<PropertySuggestion[]>("/api/pricing/suggestions");
      setRows(data);
      setPrices(
        Object.fromEntries(
          data
            .filter((r) => r.suggested_nightly != null)
            .map((r) => [r.property_id, String(r.suggested_nightly)])
        )
      );
    } catch (e) {
      toast({ title: "Erro ao carregar sugestões", description: e instanceof Error ? e.message : "", variant: "error" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const withSuggestion = useMemo(() => rows.filter((r) => r.suggested_nightly != null), [rows]);

  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleAll = () =>
    setSelected((s) =>
      s.size === withSuggestion.length ? new Set() : new Set(withSuggestion.map((r) => r.property_id))
    );

  const items = useMemo(
    () =>
      [...selected]
        .map((id) => ({ property_id: id, price_cents: Math.round(Number(prices[id] ?? 0) * 100) }))
        .filter((i) => i.price_cents >= 100),
    [selected, prices]
  );

  const canApply =
    items.length > 0 && (mode === "base" || (seasonStart && seasonEnd && seasonStart <= seasonEnd));

  const apply = async () => {
    setApplying(true);
    try {
      const result = await api<{ applied: number }>("/api/pricing/suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          items,
          season_name: seasonName.trim() || undefined,
          season_start: mode === "season" ? seasonStart : undefined,
          season_end: mode === "season" ? seasonEnd : undefined,
        }),
      });
      toast({
        title:
          mode === "base"
            ? `Preço-base atualizado em ${result.applied} imóvel(is)`
            : `Regra de temporada criada para ${result.applied} imóvel(is)`,
      });
      setSelected(new Set());
      await Promise.all([load(), onApplied()]);
    } catch (e) {
      toast({ title: "Erro ao aplicar", description: e instanceof Error ? e.message : "", variant: "error" });
    } finally {
      setApplying(false);
      setConfirming(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-gray-400">
        <Loader2 className="animate-spin" size={20} aria-hidden="true" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-500 max-w-2xl">
        Última tarifa sugerida pela <strong>Análise de Mercado</strong> (mediana dos comparáveis;
        Airbnb como benchmark). Edite o valor se quiser arredondar, selecione os imóveis e aplique —
        no <strong>preço-base</strong> ou como <strong>regra de temporada</strong> para um período.
      </p>

      {/* Tabela */}
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-left text-[11px] uppercase tracking-wider text-gray-400">
              <th className="px-4 py-3">
                <input
                  type="checkbox"
                  checked={withSuggestion.length > 0 && selected.size === withSuggestion.length}
                  onChange={toggleAll}
                  className="h-4 w-4 rounded border-gray-300 text-brand-500 focus:ring-brand-400"
                  aria-label="Selecionar todos"
                />
              </th>
              <th className="px-4 py-3 font-semibold">Imóvel</th>
              <th className="px-4 py-3 font-semibold">Preço-base atual</th>
              <th className="px-4 py-3 font-semibold">Sugerida</th>
              <th className="px-4 py-3 font-semibold">Δ</th>
              <th className="px-4 py-3 font-semibold">Aplicar (R$)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const hasSuggestion = row.suggested_nightly != null;
              const suggestedCents = hasSuggestion ? Math.round((row.suggested_nightly as number) * 100) : 0;
              const deltaPct =
                hasSuggestion && row.base_price_cents > 0
                  ? ((suggestedCents - row.base_price_cents) / row.base_price_cents) * 100
                  : null;
              return (
                <tr
                  key={row.property_id}
                  className={cn(
                    "border-b border-gray-50 last:border-0",
                    hasSuggestion ? "hover:bg-gray-50/60" : "opacity-50"
                  )}
                >
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selected.has(row.property_id)}
                      onChange={() => toggle(row.property_id)}
                      disabled={!hasSuggestion}
                      className="h-4 w-4 rounded border-gray-300 text-brand-500 focus:ring-brand-400"
                      aria-label={`Selecionar ${row.name}`}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{row.name}</div>
                    <div className="font-mono text-[11px] text-gray-400">{row.code}</div>
                  </td>
                  <td className="px-4 py-3 font-mono text-gray-700">{formatCurrency(row.base_price_cents)}</td>
                  <td className="px-4 py-3">
                    {hasSuggestion ? (
                      <div>
                        <span className="font-mono font-semibold text-brand-600">
                          {formatCurrency(suggestedCents)}
                        </span>
                        <div className="text-[11px] text-gray-400">
                          {row.source} · {row.sample_size ?? 0} comps ·{" "}
                          {row.captured_at ? new Date(row.captured_at).toLocaleDateString("pt-BR") : ""}
                        </div>
                      </div>
                    ) : (
                      <Link
                        href="/market"
                        className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-brand-600"
                      >
                        Rodar análise <ExternalLink size={11} aria-hidden="true" />
                      </Link>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {deltaPct != null && (
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 font-mono text-xs font-semibold",
                          deltaPct > 1 ? "text-green-600" : deltaPct < -1 ? "text-red-500" : "text-gray-400"
                        )}
                      >
                        {deltaPct > 1 ? (
                          <TrendingUp size={12} aria-hidden="true" />
                        ) : deltaPct < -1 ? (
                          <TrendingDown size={12} aria-hidden="true" />
                        ) : (
                          <Minus size={12} aria-hidden="true" />
                        )}
                        {deltaPct > 0 ? "+" : ""}
                        {deltaPct.toFixed(0)}%
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {hasSuggestion && (
                      <input
                        type="number"
                        step="1"
                        min={1}
                        value={prices[row.property_id] ?? ""}
                        onChange={(e) =>
                          setPrices((p) => ({ ...p, [row.property_id]: e.target.value }))
                        }
                        className={cn(inputClass, "w-28 font-mono")}
                      />
                    )}
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="py-12 text-center text-sm text-gray-400">
                  Nenhum imóvel cadastrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Barra de aplicação */}
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-card">
        <div>
          <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-gray-500">
            Como aplicar
          </label>
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as ApplyMode)}
            className={cn(inputClass, "bg-white cursor-pointer")}
          >
            <option value="base">Atualizar preço-base do imóvel</option>
            <option value="season">Criar regra de temporada</option>
          </select>
        </div>
        {mode === "season" && (
          <>
            <div>
              <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                Nome da regra
              </label>
              <input
                value={seasonName}
                onChange={(e) => setSeasonName(e.target.value)}
                placeholder="Tarifa sugerida (opcional)"
                className={inputClass}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                Início
              </label>
              <input type="date" value={seasonStart} onChange={(e) => setSeasonStart(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                Fim
              </label>
              <input type="date" value={seasonEnd} onChange={(e) => setSeasonEnd(e.target.value)} className={inputClass} />
            </div>
          </>
        )}
        <div className="ml-auto">
          <Button onClick={() => setConfirming(true)} disabled={!canApply || applying}>
            Aplicar em {items.length} imóvel(is)
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={mode === "base" ? "Atualizar preço-base?" : "Criar regras de temporada?"}
        description={
          mode === "base"
            ? `O preço-base/noite de ${items.length} imóvel(is) será sobrescrito com os valores da coluna “Aplicar”. A alteração fica registrada no log de atividade.`
            : `Será criada 1 regra de temporada (${seasonStart.split("-").reverse().join("/")} a ${seasonEnd.split("-").reverse().join("/")}) com preço fixo para cada um dos ${items.length} imóvel(is).`
        }
        confirmLabel="Aplicar"
        loading={applying}
        onConfirm={apply}
      />
    </div>
  );
}
