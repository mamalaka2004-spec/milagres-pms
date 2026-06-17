"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, AlertCircle, GripVertical, TrendingUp, Users, Target } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils/cn";
import {
  Database,
  LeadStage,
  LEAD_STAGE_ORDER,
  LEAD_STAGE_LABELS,
} from "@/types/database";

type ConvRow = Database["public"]["Tables"]["whatsapp_conversations"]["Row"];
type LeadDataRow = Database["public"]["Tables"]["whatsapp_lead_data"]["Row"];
type SalesConvRow = ConvRow & { lead_data: LeadDataRow | null };

interface ApiResp<T> {
  success: boolean;
  data?: T;
  error?: string;
}
async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init);
  const json = (await res.json()) as ApiResp<T>;
  if (!json.success) throw new Error(json.error || `HTTP ${res.status}`);
  return json.data as T;
}

// Existing palette only — same stage colors used across the Sales module.
const STAGE_COLUMN: Record<LeadStage, { head: string; ring: string }> = {
  apresentacao: { head: "bg-gray-100 text-gray-700 border-gray-200", ring: "ring-gray-300" },
  qualificacao_objetivo: { head: "bg-blue-50 text-blue-700 border-blue-200", ring: "ring-blue-300" },
  qualificacao_orcamento: { head: "bg-indigo-50 text-indigo-700 border-indigo-200", ring: "ring-indigo-300" },
  apresentacao_imoveis: { head: "bg-violet-50 text-violet-700 border-violet-200", ring: "ring-violet-300" },
  handoff: { head: "bg-amber-50 text-amber-800 border-amber-300", ring: "ring-amber-300" },
  encerramento: { head: "bg-gray-50 text-gray-500 border-gray-200", ring: "ring-gray-300" },
};

function formatTime(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) {
    return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  }
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

export function SalesKanban({
  lineId,
  onOpenLead,
}: {
  lineId: string;
  onOpenLead: (conversationId: string) => void;
}) {
  const [conversations, setConversations] = useState<SalesConvRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overStage, setOverStage] = useState<LeadStage | null>(null);
  const supabase = useMemo(() => createClient(), []);

  const load = useCallback(async () => {
    try {
      const data = await api<SalesConvRow[]>(`/api/sales/conversations?line_id=${lineId}`);
      setConversations(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao carregar");
    } finally {
      setLoading(false);
    }
  }, [lineId]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [lineId, load]);

  useEffect(() => {
    const ch = supabase
      .channel(`sales-kanban-${lineId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "whatsapp_conversations", filter: `line_id=eq.${lineId}` }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "whatsapp_lead_data" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [supabase, lineId, load]);

  const grouped = useMemo(() => {
    const buckets = {} as Record<LeadStage, SalesConvRow[]>;
    for (const s of LEAD_STAGE_ORDER) buckets[s] = [];
    for (const c of conversations) {
      const stage = c.lead_data?.lead_stage as LeadStage | undefined;
      if (stage && stage in buckets) buckets[stage].push(c);
      else buckets.apresentacao.push(c); // unstaged → first column
    }
    return buckets;
  }, [conversations]);

  const metrics = useMemo(() => {
    const total = conversations.length;
    const scores = conversations
      .map((c) => c.lead_data?.confidence_score)
      .filter((s): s is number => typeof s === "number");
    const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
    const handoff = grouped.handoff.length;
    const advanced = conversations.filter((c) => {
      const st = c.lead_data?.lead_stage as LeadStage | undefined;
      return st && st !== "apresentacao";
    }).length;
    return {
      total,
      avg,
      handoff,
      advanceRate: total ? Math.round((advanced / total) * 100) : 0,
    };
  }, [conversations, grouped]);

  async function moveTo(conversationId: string, stage: LeadStage) {
    const current = conversations.find((c) => c.id === conversationId);
    if (!current || current.lead_data?.lead_stage === stage) return;
    // Optimistic update
    setConversations((prev) =>
      prev.map((c) =>
        c.id === conversationId
          ? { ...c, lead_data: { ...(c.lead_data ?? ({} as LeadDataRow)), lead_stage: stage } as LeadDataRow }
          : c
      )
    );
    try {
      await api(`/api/sales/conversations/${conversationId}/lead`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lead_stage: stage }),
      });
    } catch {
      load(); // revert from server on failure
    }
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400">
        <Loader2 className="animate-spin" size={20} aria-hidden="true" />
      </div>
    );
  }
  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center text-red-500 gap-2 text-sm">
        <AlertCircle size={16} aria-hidden="true" /> {error}
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 gap-3">
      {/* Metrics bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Metric icon={Users} label="Leads no funil" value={String(metrics.total)} />
        <Metric icon={TrendingUp} label="Taxa de avanço" value={`${metrics.advanceRate}%`} sub="saíram da apresentação" />
        <Metric icon={Target} label="Em handoff" value={String(metrics.handoff)} sub="prontos p/ humano" />
        <Metric
          icon={Target}
          label="Confiança média IA"
          value={metrics.avg !== null ? `${metrics.avg.toFixed(1)}/10` : "—"}
        />
      </div>

      {/* Board */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden scrollbar-thin pb-1">
        <div className="flex gap-3 h-full min-h-0" style={{ minWidth: "max-content" }}>
          {LEAD_STAGE_ORDER.map((stage) => {
            const items = grouped[stage];
            const col = STAGE_COLUMN[stage];
            return (
              <div
                key={stage}
                onDragOver={(e) => { e.preventDefault(); setOverStage(stage); }}
                onDragLeave={() => setOverStage((s) => (s === stage ? null : s))}
                onDrop={(e) => {
                  e.preventDefault();
                  setOverStage(null);
                  if (dragId) moveTo(dragId, stage);
                  setDragId(null);
                }}
                className={cn(
                  "w-[260px] shrink-0 flex flex-col rounded-xl border bg-gray-50/60 transition-colors duration-150",
                  overStage === stage ? cn("ring-2", col.ring, "bg-white") : "border-gray-200"
                )}
              >
                <div className={cn("flex items-center justify-between px-3 py-2 rounded-t-xl border-b", col.head)}>
                  <span className="text-[11px] font-bold uppercase tracking-wider">{LEAD_STAGE_LABELS[stage]}</span>
                  <span className="text-[11px] font-semibold opacity-70">{items.length}</span>
                </div>
                <ul className="flex-1 overflow-y-auto scrollbar-thin p-2 space-y-2 min-h-[80px]">
                  {items.length === 0 ? (
                    <li className="text-[11px] text-gray-300 text-center py-6 select-none">
                      Arraste leads para cá
                    </li>
                  ) : (
                    items.map((c) => (
                      <KanbanCard
                        key={c.id}
                        conv={c}
                        dragging={dragId === c.id}
                        onDragStart={() => setDragId(c.id)}
                        onDragEnd={() => { setDragId(null); setOverStage(null); }}
                        onOpen={() => onOpenLead(c.id)}
                      />
                    ))
                  )}
                </ul>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: typeof Users;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-3 lg:p-4">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[11px] lg:text-xs text-gray-500 font-medium">{label}</span>
        <Icon size={15} className="text-amber-500 shrink-0" aria-hidden="true" />
      </div>
      <div className="text-xl lg:text-2xl font-bold text-gray-900 tracking-tight leading-tight">{value}</div>
      {sub && <div className="text-[10px] text-gray-400 mt-0.5">{sub}</div>}
    </div>
  );
}

function KanbanCard({
  conv,
  dragging,
  onDragStart,
  onDragEnd,
  onOpen,
}: {
  conv: SalesConvRow;
  dragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onOpen: () => void;
}) {
  const conf = conv.lead_data?.confidence_score;
  return (
    <li
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onOpen}
      className={cn(
        "group bg-white rounded-lg border border-gray-200 shadow-sm p-2.5 cursor-grab active:cursor-grabbing transition-all duration-150 hover:shadow-md hover:-translate-y-0.5 motion-reduce:transform-none motion-reduce:transition-none",
        dragging && "opacity-50 ring-2 ring-amber-300"
      )}
    >
      <div className="flex items-start gap-1.5">
        <GripVertical size={13} className="text-gray-300 mt-0.5 shrink-0 group-hover:text-gray-400" aria-hidden="true" />
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-2">
            <span className="font-medium text-sm text-gray-900 truncate">
              {conv.contact_name || conv.contact_phone}
            </span>
            <span className="text-[10px] text-gray-400 shrink-0">{formatTime(conv.last_message_at)}</span>
          </div>
          {conv.lead_data?.objetivo && (
            <p className="text-[11px] text-gray-500 truncate mt-0.5">{conv.lead_data.objetivo}</p>
          )}
          <div className="flex items-center gap-1.5 mt-1.5">
            {typeof conf === "number" && (
              <span
                className={cn(
                  "text-[10px] font-bold px-1 rounded",
                  conf >= 8 ? "bg-emerald-50 text-emerald-700" : conf >= 5 ? "bg-amber-50 text-amber-700" : "bg-rose-50 text-rose-700"
                )}
              >
                {conf}/10
              </span>
            )}
            {conv.lead_data?.origem === "prospeccao_fria" && (
              <span className="text-[9px] uppercase tracking-wide text-amber-700 font-semibold">fria</span>
            )}
            {conv.unread_count > 0 && (
              <span className="ml-auto bg-amber-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                {conv.unread_count}
              </span>
            )}
          </div>
        </div>
      </div>
    </li>
  );
}
