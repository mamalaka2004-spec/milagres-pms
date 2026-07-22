"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Search, Loader2, MessageSquare, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils/cn";
import { api } from "@/lib/chat/utils";
import type { BoardData, DealCardData, FunnelType } from "@/types/funnel";

function formatBRL(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

const STATUS_META: Record<string, { label: string; color: string }> = {
  open: { label: "Aberto", color: "#3b82f6" },
  won: { label: "Ganho", color: "#10b981" },
  lost: { label: "Perdido", color: "#ef4444" },
};

/** Funil em LISTA: todos os negócios com detalhes, filtros e ordenação. */
export function FunnelList({
  type,
  onOpenDeal,
}: {
  type: FunnelType;
  onOpenDeal?: (deal: DealCardData) => void;
}) {
  const [board, setBoard] = useState<BoardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [stageId, setStageId] = useState("");
  const [status, setStatus] = useState("");
  const [sort, setSort] = useState<"stage" | "value" | "recent">("stage");
  const [detail, setDetail] = useState<DealCardData | null>(null);

  const load = useCallback(async () => {
    try {
      setBoard(await api<BoardData>(`/api/funnel/board?type=${type}&unassigned=0`));
    } finally {
      setLoading(false);
    }
  }, [type]);

  useEffect(() => {
    load();
  }, [load]);

  const stageById = useMemo(
    () => new Map((board?.stages ?? []).map((s) => [s.id, s])),
    [board?.stages]
  );

  const deals = useMemo(() => {
    let list = (board?.deals ?? []).filter((d) => !d.virtual);
    if (q.trim()) {
      const term = q.trim().toLowerCase();
      list = list.filter(
        (d) =>
          d.title.toLowerCase().includes(term) ||
          (d.contact_name ?? "").toLowerCase().includes(term) ||
          (d.contact_phone ?? "").includes(term)
      );
    }
    if (stageId) list = list.filter((d) => d.stage_id === stageId);
    if (status) list = list.filter((d) => d.status === status);
    const stageOrder = new Map((board?.stages ?? []).map((s, i) => [s.id, i]));
    return [...list].sort((a, b) => {
      if (sort === "value") return b.value - a.value;
      if (sort === "recent")
        return (b.last_message_at ?? b.updated_at).localeCompare(a.last_message_at ?? a.updated_at);
      return (
        (stageOrder.get(a.stage_id ?? "") ?? 99) - (stageOrder.get(b.stage_id ?? "") ?? 99) ||
        a.sort_order - b.sort_order
      );
    });
  }, [board, q, stageId, status, sort]);

  const totalValue = deals.reduce((sum, d) => sum + (d.status !== "lost" ? d.value : 0), 0);

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center text-gray-400">
        <Loader2 className="animate-spin" size={20} />
      </div>
    );
  }

  const selectClass =
    "rounded-lg border border-gray-200 bg-white px-2.5 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40";

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1 basis-52">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar negócio, contato ou telefone…"
            className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2 pl-9 pr-3 text-sm focus:border-brand-500 focus:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40"
          />
        </div>
        <select value={stageId} onChange={(e) => setStageId(e.target.value)} className={selectClass}>
          <option value="">Todas etapas</option>
          {(board?.stages ?? []).map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className={selectClass}>
          <option value="">Todos status</option>
          <option value="open">Aberto</option>
          <option value="won">Ganho</option>
          <option value="lost">Perdido</option>
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} className={selectClass}>
          <option value="stage">Por etapa</option>
          <option value="value">Maior valor</option>
          <option value="recent">Mais recente</option>
        </select>
        <span className="ml-auto text-xs text-gray-500">
          {deals.length} negócio(s) · <b className="text-gray-800">{formatBRL(totalValue)}</b> em aberto/ganho
        </span>
      </div>

      {/* Tabela */}
      <div className="min-h-0 flex-1 overflow-auto rounded-xl border border-gray-200 scrollbar-thin">
        {deals.length === 0 ? (
          <div className="flex h-full items-center justify-center py-14 text-sm text-gray-400">
            Nenhum negócio encontrado.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-gray-50/95 backdrop-blur">
              <tr className="border-b border-gray-100 text-left text-[11px] uppercase tracking-wide text-gray-400">
                <th className="px-4 py-2.5 font-medium">Negócio</th>
                <th className="px-4 py-2.5 font-medium">Contato</th>
                <th className="px-4 py-2.5 font-medium">Etapa</th>
                <th className="px-4 py-2.5 font-medium">Valor</th>
                <th className="px-4 py-2.5 font-medium">Tags</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium">Últ. atividade</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {deals.map((d) => {
                const stage = d.stage_id ? stageById.get(d.stage_id) : null;
                const sm = STATUS_META[d.status] ?? STATUS_META.open;
                return (
                  <tr key={d.id} onClick={() => setDetail(d)} className="cursor-pointer hover:bg-gray-50/60">
                    <td className="px-4 py-2.5">
                      <span className="font-medium text-gray-900">{d.title}</span>
                      {d.property_name && (
                        <div className="text-[11px] text-gray-400">{d.property_name}</div>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="text-gray-800">{d.contact_name || "—"}</div>
                      <div className="text-[11px] text-gray-400">{d.contact_phone || ""}</div>
                    </td>
                    <td className="px-4 py-2.5">
                      {stage ? (
                        <span
                          className="inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold"
                          style={{ color: stage.color, background: `${stage.color}18` }}
                        >
                          {stage.name}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 font-medium text-gray-800">
                      {d.value > 0 ? formatBRL(d.value) : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex max-w-44 flex-wrap gap-1">
                        {d.tags.slice(0, 3).map((t) => (
                          <span key={t.id} className="rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ color: t.color, background: `${t.color}18` }}>
                            {t.name}
                          </span>
                        ))}
                        {d.tags.length > 3 && <span className="text-[10px] text-gray-400">+{d.tags.length - 3}</span>}
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ color: sm.color, background: `${sm.color}18` }}>
                        {sm.label}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-gray-500">
                      {fmtDate(d.last_message_at ?? d.updated_at)}
                      {d.unread_count > 0 && (
                        <span className="ml-1.5 rounded-full bg-brand-500 px-1.5 py-0.5 text-[9px] font-semibold text-white">
                          {d.unread_count}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Detalhe do negócio */}
      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-w-lg">
          {detail && (
            <>
              <DialogHeader>
                <DialogTitle>{detail.title}</DialogTitle>
              </DialogHeader>
              <DialogBody className="space-y-3 text-sm">
                <DetailRow label="Contato" value={`${detail.contact_name || "—"}${detail.contact_phone ? ` · ${detail.contact_phone}` : ""}`} />
                <DetailRow label="Etapa" value={detail.stage_id ? stageById.get(detail.stage_id)?.name ?? "—" : "Sem etapa"} />
                <DetailRow label="Valor" value={detail.value > 0 ? formatBRL(detail.value) : "—"} />
                <DetailRow label="Status" value={STATUS_META[detail.status]?.label ?? detail.status} />
                {detail.status === "lost" && detail.lost_reason && (
                  <DetailRow label="Motivo da perda" value={detail.lost_reason} />
                )}
                <DetailRow label="Imóvel" value={detail.property_name || "—"} />
                <DetailRow label="Previsão de fechamento" value={fmtDate(detail.expected_close_date)} />
                <DetailRow label="Criado em" value={fmtDate(detail.created_at)} />
                <DetailRow label="Última atividade" value={fmtDate(detail.last_message_at ?? detail.updated_at)} />
                {detail.tags.length > 0 && (
                  <div>
                    <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-gray-400">Tags</div>
                    <div className="flex flex-wrap gap-1">
                      {detail.tags.map((t) => (
                        <span key={t.id} className="rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ color: t.color, background: `${t.color}18` }}>
                          {t.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {detail.notes && (
                  <div>
                    <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-gray-400">Notas</div>
                    <p className="whitespace-pre-wrap rounded-lg bg-gray-50 p-2.5 text-xs text-gray-700">{detail.notes}</p>
                  </div>
                )}
              </DialogBody>
              <DialogFooter>
                <button onClick={() => setDetail(null)} className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-50">
                  <X size={14} /> Fechar
                </button>
                {detail.conversation_id && onOpenDeal && (
                  <button
                    onClick={() => {
                      onOpenDeal(detail);
                      setDetail(null);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600"
                  >
                    <MessageSquare size={14} /> Abrir conversa
                  </button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className={cn("flex items-baseline justify-between gap-4 border-b border-gray-50 pb-2")}>
      <span className="shrink-0 text-[11px] font-medium uppercase tracking-wide text-gray-400">{label}</span>
      <span className="text-right text-gray-800">{value}</span>
    </div>
  );
}
