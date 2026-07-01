"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  pointerWithin,
  rectIntersection,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Loader2, AlertCircle, TrendingUp, Users, Trophy } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils/cn";
import { api } from "@/lib/chat/utils";
import { DealCard } from "./deal-card";
import {
  VIRTUAL_STAGE_ID,
  isVirtualDealId,
  conversationIdFromVirtual,
  type BoardData,
  type DealCardData,
  type FunnelStage,
  type FunnelType,
} from "@/types/funnel";

interface Column {
  id: string;
  name: string;
  color: string;
  is_won?: boolean;
  is_lost?: boolean;
  virtual?: boolean;
}

function formatBRL(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

export function FunnelBoard({
  type,
  onOpenDeal,
}: {
  type: FunnelType;
  onOpenDeal?: (deal: DealCardData) => void;
}) {
  const [board, setBoard] = useState<BoardData | null>(null);
  const [pipelineId, setPipelineId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeDeal, setActiveDeal] = useState<DealCardData | null>(null);
  const [localOrder, setLocalOrder] = useState<Record<string, string[]> | null>(null);
  const draggingRef = useRef(false);
  const supabase = useMemo(() => createClient(), []);

  const load = useCallback(async () => {
    try {
      const qs = pipelineId ? `&pipeline_id=${pipelineId}` : "";
      const data = await api<BoardData>(`/api/funnel/board?type=${type}${qs}`);
      setBoard(data);
      if (!pipelineId && data.pipeline) setPipelineId(data.pipeline.id);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao carregar o funil");
    } finally {
      setLoading(false);
    }
  }, [type, pipelineId]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  // Realtime: recarrega quando muda algo (mas nunca no meio de um arrasto).
  useEffect(() => {
    const ch = supabase
      .channel(`funnel-${type}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "funnel_deals" }, () => {
        if (!draggingRef.current) load();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "whatsapp_conversations" }, () => {
        if (!draggingRef.current) load();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [supabase, type, load]);

  const stages: FunnelStage[] = board?.stages ?? [];
  const columns: Column[] = useMemo(() => {
    const cols: Column[] = stages.map((s) => ({
      id: s.id,
      name: s.name,
      color: s.color,
      is_won: s.is_won,
      is_lost: s.is_lost,
    }));
    // Coluna virtual (conversas sem negócio) — só faz sentido se houver alguma.
    const hasVirtual = (board?.deals ?? []).some((d) => d.virtual);
    if (hasVirtual) cols.unshift({ id: VIRTUAL_STAGE_ID, name: "Sem etapa", color: "#cbd5e1", virtual: true });
    return cols;
  }, [stages, board?.deals]);

  const dealsById = useMemo(() => {
    const m = new Map<string, DealCardData>();
    for (const d of board?.deals ?? []) m.set(d.id, d);
    return m;
  }, [board?.deals]);

  const dealsByCol = useMemo(() => {
    const buckets: Record<string, DealCardData[]> = {};
    for (const c of columns) buckets[c.id] = [];
    for (const d of board?.deals ?? []) {
      const col = d.stage_id ?? VIRTUAL_STAGE_ID;
      (buckets[col] ||= []).push(d);
    }
    return buckets;
  }, [board?.deals, columns]);

  const orderedIdsForCol = useCallback(
    (colId: string): string[] => localOrder?.[colId] ?? (dealsByCol[colId] ?? []).map((d) => d.id),
    [localOrder, dealsByCol]
  );

  const metrics = useMemo(() => {
    const real = (board?.deals ?? []).filter((d) => !d.virtual);
    const total = real.length;
    const value = real.reduce((a, d) => a + (d.value || 0), 0);
    const won = real.filter((d) => stages.find((s) => s.id === d.stage_id)?.is_won).length;
    return { total, value, won };
  }, [board?.deals, stages]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } })
  );

  const collision: CollisionDetection = (args) => {
    const pointer = pointerWithin(args);
    return pointer.length > 0 ? pointer : rectIntersection(args);
  };

  function resolveCol(overId: string, overData: Record<string, unknown> | undefined): string | null {
    if (overData?.type === "column") return String(overData.stageId);
    if (overData?.type === "deal") return String(overData.stageId);
    if (columns.some((c) => c.id === overId)) return overId;
    return null;
  }

  function onDragStart(e: DragStartEvent) {
    draggingRef.current = true;
    setActiveDeal(dealsById.get(String(e.active.id)) ?? null);
    const seed: Record<string, string[]> = {};
    for (const c of columns) seed[c.id] = (dealsByCol[c.id] ?? []).map((d) => d.id);
    setLocalOrder(seed);
  }

  function onDragOver(e: DragOverEvent) {
    const { active, over } = e;
    if (!over || !localOrder) return;
    const activeId = String(active.id);
    const overId = String(over.id);
    if (activeId === overId) return;
    const overCol = resolveCol(overId, over.data?.current as Record<string, unknown> | undefined);
    if (!overCol) return;
    const fromCol = Object.keys(localOrder).find((cid) => localOrder[cid].includes(activeId));
    if (!fromCol) return;

    setLocalOrder((prev) => {
      if (!prev) return prev;
      const next = { ...prev };
      const fromList = [...(next[fromCol] ?? [])];
      const toList = fromCol === overCol ? fromList : [...(next[overCol] ?? [])];
      const fromIdx = fromList.indexOf(activeId);
      let toIdx = toList.indexOf(overId);
      if (toIdx === -1) toIdx = toList.length;
      if (fromCol === overCol) {
        next[fromCol] = arrayMove(fromList, fromIdx, toIdx);
      } else {
        fromList.splice(fromIdx, 1);
        toList.splice(toIdx, 0, activeId);
        next[fromCol] = fromList;
        next[overCol] = toList;
      }
      return next;
    });
  }

  async function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    const activeId = String(active.id);
    const deal = dealsById.get(activeId);
    setActiveDeal(null);
    const finish = () => {
      setLocalOrder(null);
      draggingRef.current = false;
    };
    if (!over || !deal) return finish();

    const targetCol = resolveCol(String(over.id), over.data?.current as Record<string, unknown> | undefined);
    if (!targetCol || targetCol === VIRTUAL_STAGE_ID) return finish();

    const order = orderedIdsForCol(targetCol);
    const newIdx = Math.max(0, order.indexOf(activeId));
    const newSortOrder = (newIdx + 1) * 1000;

    try {
      if (isVirtualDealId(activeId)) {
        // Conversa sem negócio → cria o negócio nesta etapa.
        await api(`/api/funnel/deals`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            pipeline_id: board?.pipeline?.id,
            stage_id: targetCol,
            title: deal.title,
            conversation_id: conversationIdFromVirtual(activeId),
            sort_order: newSortOrder,
          }),
        });
      } else {
        const stageChanged = targetCol !== deal.stage_id;
        const orderChanged =
          !stageChanged && newIdx !== (dealsByCol[deal.stage_id ?? ""] ?? []).findIndex((d) => d.id === activeId);
        if (stageChanged || orderChanged) {
          await api(`/api/funnel/deals/${activeId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ stage_id: targetCol, sort_order: newSortOrder }),
          });
        }
      }
      await load();
    } catch {
      await load();
    } finally {
      finish();
    }
  }

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center text-gray-400">
        <Loader2 className="animate-spin" size={20} />
      </div>
    );
  }
  if (error) {
    return (
      <div className="flex flex-1 items-center justify-center gap-2 text-sm text-red-500">
        <AlertCircle size={16} /> {error}
      </div>
    );
  }
  if (!board?.pipeline) {
    return (
      <div className="flex flex-1 items-center justify-center px-6 text-center text-sm text-gray-400">
        Nenhum funil configurado. Crie um em <span className="mx-1 font-medium">Ajustes → Funil &amp; Tags</span>.
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      {/* Métricas + seletor de funil */}
      <div className="flex flex-wrap items-center gap-3">
        <Metric icon={Users} label="Negócios" value={String(metrics.total)} />
        <Metric icon={TrendingUp} label="Valor no funil" value={formatBRL(metrics.value)} />
        <Metric icon={Trophy} label="Ganhos" value={String(metrics.won)} />
        {(board.pipelines?.length ?? 0) > 1 && (
          <select
            value={pipelineId ?? ""}
            onChange={(e) => {
              setPipelineId(e.target.value);
              setLoading(true);
            }}
            className="ml-auto rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40"
          >
            {board.pipelines.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        )}
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={collision}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
        onDragCancel={() => {
          setActiveDeal(null);
          setLocalOrder(null);
          draggingRef.current = false;
        }}
      >
        <div className="scrollbar-thin flex-1 overflow-x-auto overflow-y-hidden pb-1">
          <div className="flex h-full min-h-0 gap-3" style={{ minWidth: "max-content" }}>
            {columns.map((col) => (
              <StageColumn
                key={col.id}
                col={col}
                dealIds={orderedIdsForCol(col.id)}
                dealsById={dealsById}
                onOpenDeal={onOpenDeal}
              />
            ))}
          </div>
        </div>
        <DragOverlay>
          {activeDeal ? (
            <div className="w-[248px] rotate-2 rounded-lg border border-brand-300 bg-white p-2.5 text-sm font-medium text-gray-900 shadow-lg">
              {activeDeal.title}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

function StageColumn({
  col,
  dealIds,
  dealsById,
  onOpenDeal,
}: {
  col: Column;
  dealIds: string[];
  dealsById: Map<string, DealCardData>;
  onOpenDeal?: (deal: DealCardData) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: col.id, data: { type: "column", stageId: col.id } });
  const deals = dealIds.map((id) => dealsById.get(id)).filter(Boolean) as DealCardData[];

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex w-[264px] shrink-0 flex-col rounded-xl border bg-gray-50/60 transition-colors duration-150",
        isOver ? "border-brand-300 bg-white ring-2 ring-brand-200" : "border-gray-200"
      )}
    >
      <div
        className="flex items-center justify-between rounded-t-xl border-b px-3 py-2"
        style={{ borderColor: `${col.color}55`, background: `${col.color}18` }}
      >
        <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider" style={{ color: col.color }}>
          <span className="h-2 w-2 rounded-full" style={{ background: col.color }} />
          {col.name}
          {col.is_won && <span className="text-emerald-600">✓</span>}
        </span>
        <span className="text-[11px] font-semibold text-gray-400">{deals.length}</span>
      </div>
      <SortableContext items={dealIds} strategy={verticalListSortingStrategy}>
        <ul className="scrollbar-thin min-h-[80px] flex-1 space-y-2 overflow-y-auto p-2">
          {deals.length === 0 ? (
            <li className="select-none py-6 text-center text-[11px] text-gray-300">Arraste para cá</li>
          ) : (
            deals.map((d) => <DealCard key={d.id} deal={d} columnId={col.id} onOpen={(deal) => onOpenDeal?.(deal)} />)
          )}
        </ul>
      </SortableContext>
    </div>
  );
}

function Metric({ icon: Icon, label, value }: { icon: typeof Users; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 shadow-sm">
      <Icon size={15} className="text-brand-500" />
      <div>
        <div className="text-[10px] font-medium text-gray-500">{label}</div>
        <div className="text-sm font-bold leading-tight text-gray-900">{value}</div>
      </div>
    </div>
  );
}
