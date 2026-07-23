"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Loader2,
  ArrowRight,
  Undo2,
  Sparkles,
  Wand2,
  Instagram,
  Home,
  ChevronLeft,
  ChevronRight,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { api } from "@/lib/chat/utils";
import { toast } from "@/components/ui/use-toast";
import { ConfirmDialog } from "@/components/ui";
import { CONTACT_CATEGORY_LABELS } from "@/types/campaign";

interface ChangeRow {
  id: string;
  raw_label: string | null;
  display_name: string | null;
  first_name: string | null;
  last_name: string | null;
  social_name: string | null;
  instagram_handle: string | null;
  unit_hint: string | null;
  category: string | null;
  name_source: "manual" | "heuristic" | "ai" | "import" | null;
  name_confidence: "alta" | "media" | "baixa" | null;
  phone_e164: string | null;
  changed: boolean;
  can_revert: boolean;
}

interface Summary {
  total: number;
  alterados: number;
  por_ia: number;
  por_regra: number;
  alta: number;
  media: number;
  baixa: number;
  com_primeiro_nome: number;
}

const PAGE = 100;

const CONF_META: Record<string, { label: string; color: string }> = {
  alta: { label: "Alta", color: "#10b981" },
  media: { label: "Revisar", color: "#f59e0b" },
  baixa: { label: "Baixa", color: "#ef4444" },
};

/**
 * Auditoria da organização de nomes: mostra ANTES → DEPOIS de cada contato,
 * quem sugeriu (regra ou IA), a confiança, e permite desfazer.
 * O "antes" vem de `raw_label`, o rótulo original da importação.
 */
export function NameChangesTab() {
  const [rows, setRows] = useState<ChangeRow[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [source, setSource] = useState("");
  const [confidence, setConfidence] = useState("");
  const [onlyChanged, setOnlyChanged] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmRevert, setConfirmRevert] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams({ limit: String(PAGE), offset: String(page * PAGE) });
      if (source) p.set("source", source);
      if (confidence) p.set("confidence", confidence);
      const res = await api<{ changes: ChangeRow[]; total: number; summary: Summary }>(
        `/api/contacts/changes?${p}`
      );
      setRows(res.changes);
      setTotal(res.total);
      setSummary(res.summary);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [page, source, confidence]);

  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    setPage(0);
  }, [source, confidence]);

  async function revert(ids: string[]) {
    if (ids.length === 0) return;
    setBusy(true);
    try {
      const res = await api<{ reverted: number }>(`/api/contacts/changes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contact_ids: ids }),
      });
      toast({
        title: "Nomes revertidos",
        description: `${res.reverted} contato(s) voltaram ao nome original`,
        variant: "success",
      });
      setSelected(new Set());
      load();
    } catch (e) {
      toast({ title: "Erro ao reverter", description: e instanceof Error ? e.message : "", variant: "error" });
    } finally {
      setBusy(false);
    }
  }

  const shown = onlyChanged ? rows.filter((r) => r.changed) : rows;
  const totalPages = Math.max(1, Math.ceil(total / PAGE));
  const selectClass =
    "rounded-lg border border-gray-200 bg-white px-2.5 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40";

  return (
    <div className="space-y-4">
      {/* Resumo */}
      {summary && (
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <SummaryCard label="Com primeiro nome" value={`${summary.com_primeiro_nome}`} sub={`de ${summary.total} contatos`} />
          <SummaryCard label="Nomes alterados" value={`${summary.alterados}`} sub="antes ≠ depois" />
          <SummaryCard label="Pela IA" value={`${summary.por_ia}`} sub={`${summary.por_regra} por regra`} />
          <SummaryCard
            label="Precisam de olhada"
            value={`${summary.media + summary.baixa}`}
            sub={`${summary.alta} de alta confiança`}
          />
        </div>
      )}

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2">
        <select value={source} onChange={(e) => setSource(e.target.value)} className={selectClass}>
          <option value="">Toda origem</option>
          <option value="ai">Sugerido pela IA</option>
          <option value="heuristic">Regra automática</option>
          <option value="manual">Editado à mão</option>
        </select>
        <select value={confidence} onChange={(e) => setConfidence(e.target.value)} className={selectClass}>
          <option value="">Qualquer confiança</option>
          <option value="alta">Alta</option>
          <option value="media">Revisar</option>
          <option value="baixa">Baixa</option>
        </select>
        <label className="flex items-center gap-1.5 text-xs text-gray-600">
          <input
            type="checkbox"
            checked={onlyChanged}
            onChange={(e) => setOnlyChanged(e.target.checked)}
            className="accent-brand-500"
          />
          só os que mudaram
        </label>
        {selected.size > 0 && (
          <button
            onClick={() => setConfirmRevert(true)}
            disabled={busy}
            className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
          >
            <Undo2 size={13} /> Reverter {selected.size}
          </button>
        )}
      </div>

      {/* Lista */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        {loading ? (
          <div className="flex justify-center py-16 text-gray-400">
            <Loader2 className="animate-spin" size={20} />
          </div>
        ) : shown.length === 0 ? (
          <div className="py-14 text-center text-sm text-gray-400">Nenhuma alteração neste filtro.</div>
        ) : (
          <ul className="divide-y divide-gray-50">
            {shown.map((r) => {
              const conf = r.name_confidence ? CONF_META[r.name_confidence] : null;
              const sel = selected.has(r.id);
              return (
                <li key={r.id} className={cn("flex items-start gap-3 px-3 py-2.5", sel && "bg-red-50/40")}>
                  {r.can_revert && (
                    <button
                      onClick={() =>
                        setSelected((p) => {
                          const n = new Set(p);
                          if (n.has(r.id)) n.delete(r.id);
                          else n.add(r.id);
                          return n;
                        })
                      }
                      className={cn(
                        "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                        sel ? "border-red-500 bg-red-500 text-white" : "border-gray-300"
                      )}
                      title="Marcar para reverter"
                    >
                      {sel && <Check size={10} />}
                    </button>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      {r.changed ? (
                        <>
                          <span className="truncate text-gray-400 line-through">{r.raw_label}</span>
                          <ArrowRight size={12} className="shrink-0 text-gray-300" />
                        </>
                      ) : null}
                      <span className="truncate font-medium text-gray-900">
                        {r.display_name || "(sem nome)"}
                      </span>
                      {r.name_source === "ai" ? (
                        <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-purple-50 px-1.5 py-0.5 text-[9px] font-semibold text-purple-600">
                          <Sparkles size={8} /> IA
                        </span>
                      ) : r.name_source === "heuristic" ? (
                        <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-gray-100 px-1.5 py-0.5 text-[9px] font-semibold text-gray-500">
                          <Wand2 size={8} /> regra
                        </span>
                      ) : null}
                      {conf && (
                        <span
                          className="shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-semibold"
                          style={{ color: conf.color, background: `${conf.color}18` }}
                        >
                          {conf.label}
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-gray-400">
                      <span>{r.phone_e164}</span>
                      {r.first_name && (
                        <span>
                          nome: <b className="font-medium text-gray-600">{r.first_name}</b>
                        </span>
                      )}
                      {r.last_name && <span>sobrenome: {r.last_name}</span>}
                      {r.social_name && <span>social: {r.social_name}</span>}
                      {r.instagram_handle && (
                        <span className="inline-flex items-center gap-0.5 text-pink-500">
                          <Instagram size={9} /> {r.instagram_handle}
                        </span>
                      )}
                      {r.unit_hint && (
                        <span className="inline-flex items-center gap-0.5 text-brand-700">
                          <Home size={9} /> {r.unit_hint}
                        </span>
                      )}
                      {r.category && <span>{CONTACT_CATEGORY_LABELS[r.category] ?? r.category}</span>}
                    </div>
                  </div>
                  {r.can_revert && (
                    <button
                      onClick={() => revert([r.id])}
                      disabled={busy}
                      className="shrink-0 rounded-lg p-1.5 text-gray-300 hover:text-red-500 disabled:opacity-50"
                      title="Voltar ao nome original"
                    >
                      <Undo2 size={14} />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Paginação */}
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>
          {total} registro(s){total > PAGE && ` · página ${page + 1} de ${totalPages}`}
        </span>
        {total > PAGE && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="rounded-lg border border-gray-200 p-1.5 hover:bg-gray-50 disabled:opacity-40"
            >
              <ChevronLeft size={14} />
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="rounded-lg border border-gray-200 p-1.5 hover:bg-gray-50 disabled:opacity-40"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirmRevert}
        onOpenChange={(o) => !o && setConfirmRevert(false)}
        title={`Reverter ${selected.size} nome(s)?`}
        description="Os contatos voltam ao nome original da importação e saem da lista de revisados."
        confirmLabel="Reverter"
        variant="danger"
        onConfirm={() => {
          revert([...selected]);
          setConfirmRevert(false);
        }}
      />
    </div>
  );
}

function SummaryCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3">
      <div className="text-[11px] font-medium text-gray-500">{label}</div>
      <div className="text-xl font-bold tracking-tight text-gray-900">{value}</div>
      <div className="text-[10px] text-gray-400">{sub}</div>
    </div>
  );
}
