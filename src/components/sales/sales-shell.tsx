"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  Target,
  Send,
  Loader2,
  Search,
  Bot,
  BotOff,
  AlertCircle,
  CheckCheck,
  Phone,
  Sparkles,
  LayoutGrid,
  MessageSquare,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils/cn";
import { SalesKanban } from "./sales-kanban";
import { AiAssistBar } from "@/components/chat/ai-assist-bar";
import { ComposerTools } from "@/components/chat/composer-tools";
import {
  Database,
  LeadStage,
  LEAD_STAGE_ORDER,
  LEAD_STAGE_LABELS,
  WaMessageStatus,
} from "@/types/database";

type LineRow = Database["public"]["Tables"]["whatsapp_lines"]["Row"];
type ConvRow = Database["public"]["Tables"]["whatsapp_conversations"]["Row"];
type MsgRow = Database["public"]["Tables"]["whatsapp_messages"]["Row"];
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

function formatTime(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) {
    return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  }
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

function formatTimeFull(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

const STAGE_COLOR: Record<LeadStage, string> = {
  apresentacao: "bg-gray-100 text-gray-700 border-gray-200",
  qualificacao_objetivo: "bg-blue-50 text-blue-700 border-blue-200",
  qualificacao_orcamento: "bg-indigo-50 text-indigo-700 border-indigo-200",
  apresentacao_imoveis: "bg-violet-50 text-violet-700 border-violet-200",
  handoff: "bg-amber-50 text-amber-800 border-amber-300",
  encerramento: "bg-gray-50 text-gray-500 border-gray-200",
};

export function SalesShell() {
  const [lines, setLines] = useState<LineRow[]>([]);
  const [activeLineId, setActiveLineId] = useState<string | null>(null);
  const [loadingLines, setLoadingLines] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const all = await api<LineRow[]>("/api/whatsapp/lines");
        const salesOnly = all.filter((l) => l.purpose === "sales");
        if (cancelled) return;
        setLines(salesOnly);
        if (salesOnly.length > 0) setActiveLineId(salesOnly[0].id);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load lines");
      } finally {
        if (!cancelled) setLoadingLines(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (loadingLines) {
    return (
      <div className="h-[calc(100vh-180px)] flex items-center justify-center text-gray-400">
        <Loader2 className="animate-spin" size={20} />
      </div>
    );
  }
  if (error) {
    return (
      <div className="h-[calc(100vh-180px)] flex items-center justify-center text-red-500 gap-2 text-sm">
        <AlertCircle size={16} aria-hidden="true" /> {error}
      </div>
    );
  }
  if (lines.length === 0) {
    return (
      <div className="h-[calc(100vh-180px)] flex items-center justify-center">
        <div className="text-center max-w-sm">
          <div className="w-12 h-12 rounded-full bg-amber-50 mx-auto flex items-center justify-center mb-3">
            <Target className="text-amber-600" size={20} aria-hidden="true" />
          </div>
          <h3 className="font-semibold text-gray-900 mb-1">Nenhuma linha de Vendas conectada</h3>
          <p className="text-sm text-gray-500">
            Crie uma linha com <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">purpose: &quot;sales&quot;</code> via{" "}
            <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">POST /api/whatsapp/lines</code>{" "}
            e configure o workflow `Milagres Completo` no n8n para espelhar mensagens via{" "}
            <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">/api/webhooks/whatsapp/inbound</code>{" "}
            +{" "}
            <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">/api/webhooks/whatsapp/sales-mirror</code>.
          </p>
        </div>
      </div>
    );
  }

  const activeLine = lines.find((l) => l.id === activeLineId) || lines[0];

  return <SalesWorkspace lines={lines} activeLine={activeLine} onSwitchLine={setActiveLineId} />;
}

function SalesWorkspace({
  lines,
  activeLine,
  onSwitchLine,
}: {
  lines: LineRow[];
  activeLine: LineRow;
  onSwitchLine: (id: string) => void;
}) {
  const [view, setView] = useState<"conversas" | "funil">("conversas");
  const [focusLeadId, setFocusLeadId] = useState<string | null>(null);

  return (
    <div className="h-[calc(100vh-180px)] min-h-[560px] flex flex-col">
      <div className="flex flex-wrap items-center gap-2 mb-3">
        {/* View toggle */}
        <div className="flex gap-1 p-1 bg-gray-50 rounded-lg">
          {([
            { id: "conversas", label: "Conversas", icon: MessageSquare },
            { id: "funil", label: "Funil", icon: LayoutGrid },
          ] as const).map((v) => (
            <button
              key={v.id}
              onClick={() => setView(v.id)}
              aria-pressed={view === v.id}
              className={cn(
                "px-3 py-1.5 text-xs font-semibold rounded-md transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40 flex items-center gap-1.5",
                view === v.id ? "bg-white shadow-sm text-amber-700" : "text-gray-500 hover:text-gray-700"
              )}
            >
              <v.icon size={13} aria-hidden="true" />
              {v.label}
            </button>
          ))}
        </div>

        {lines.length > 1 && (
          <div className="flex gap-1 p-1 bg-gray-50 rounded-lg">
            {lines.map((l) => (
              <button
                key={l.id}
                onClick={() => onSwitchLine(l.id)}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium rounded-md transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40 flex items-center gap-1.5",
                  activeLine.id === l.id ? "bg-white shadow-sm text-amber-700" : "text-gray-500 hover:text-gray-700"
                )}
              >
                <Phone size={11} aria-hidden="true" />
                {l.label}
                <span className="text-[10px] text-gray-400 font-normal">{l.phone}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {view === "funil" ? (
        <SalesKanban
          lineId={activeLine.id}
          onOpenLead={(id) => {
            setFocusLeadId(id);
            setView("conversas");
          }}
        />
      ) : (
        <SalesPipeline lineId={activeLine.id} focusLeadId={focusLeadId} />
      )}
    </div>
  );
}

function SalesPipeline({ lineId, focusLeadId }: { lineId: string; focusLeadId?: string | null }) {
  const [conversations, setConversations] = useState<SalesConvRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const supabase = useMemo(() => createClient(), []);
  const refetchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadConversations = useCallback(async () => {
    try {
      const data = await api<SalesConvRow[]>(`/api/sales/conversations?line_id=${lineId}`);
      setConversations(data);
      if (!selectedId && data.length > 0) setSelectedId(data[0].id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [lineId, selectedId]);

  useEffect(() => {
    setLoading(true);
    setSelectedId(null);
    loadConversations();
  }, [lineId]); // eslint-disable-line react-hooks/exhaustive-deps

  // When a lead is opened from the Funil (Kanban) view, focus it here.
  useEffect(() => {
    if (focusLeadId) setSelectedId(focusLeadId);
  }, [focusLeadId]);

  // Realtime — bump when conversations or lead data change
  useEffect(() => {
    // Debounced refetch: coalesce bursts (message + lead-data updates) into one.
    const bump = () => {
      if (refetchTimer.current) clearTimeout(refetchTimer.current);
      refetchTimer.current = setTimeout(() => loadConversations(), 600);
    };
    const ch1 = supabase
      .channel(`sales-conv-${lineId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "whatsapp_conversations", filter: `line_id=eq.${lineId}` },
        bump
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "whatsapp_lead_data" },
        bump
      )
      .subscribe();
    return () => {
      if (refetchTimer.current) clearTimeout(refetchTimer.current);
      supabase.removeChannel(ch1);
    };
  }, [supabase, lineId, loadConversations]);

  const filtered = useMemo(() => {
    if (!search.trim()) return conversations;
    const q = search.toLowerCase();
    return conversations.filter((c) =>
      (c.contact_name || "").toLowerCase().includes(q) ||
      (c.contact_phone || "").includes(q) ||
      (c.lead_data?.objetivo || "").toLowerCase().includes(q)
    );
  }, [conversations, search]);

  const grouped = useMemo(() => {
    const buckets: Record<LeadStage | "_unstaged", SalesConvRow[]> = {
      apresentacao: [],
      qualificacao_objetivo: [],
      qualificacao_orcamento: [],
      apresentacao_imoveis: [],
      handoff: [],
      encerramento: [],
      _unstaged: [],
    };
    for (const c of filtered) {
      const stage = c.lead_data?.lead_stage as LeadStage | undefined;
      if (stage && stage in buckets) buckets[stage].push(c);
      else buckets._unstaged.push(c);
    }
    return buckets;
  }, [filtered]);

  const selected = conversations.find((c) => c.id === selectedId) || null;

  return (
    <div className="flex-1 grid grid-cols-1 lg:grid-cols-[320px_1fr_320px] gap-3 overflow-hidden">
      {/* LEFT — Pipeline list grouped by stage */}
      <aside className="bg-white border border-gray-200 shadow-sm rounded-xl flex flex-col overflow-hidden min-h-0">
        <div className="p-3 border-b border-gray-100">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden="true" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Buscar lead, telefone, objetivo"
              placeholder="Buscar lead, telefone, objetivo"
              className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-gray-200 transition-colors duration-200 focus:outline-none focus:border-amber-500 focus-visible:ring-2 focus-visible:ring-brand-400/40"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto scrollbar-thin">
          {loading ? (
            <div className="p-4 flex justify-center text-gray-400">
              <Loader2 className="animate-spin" size={16} />
            </div>
          ) : error ? (
            <div className="p-4 text-sm text-red-500">{error}</div>
          ) : conversations.length === 0 ? (
            <div className="p-6 text-center text-sm text-gray-400">
              Nenhum lead. Quando alguém mandar mensagem pelo WhatsApp de Vendas, aparece aqui.
            </div>
          ) : (
            <div className="space-y-3 p-2">
              {LEAD_STAGE_ORDER.map((stage) => {
                const items = grouped[stage];
                if (items.length === 0) return null;
                return (
                  <div key={stage}>
                    <div className="px-2 py-1 flex items-center gap-2">
                      <span className={cn("text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border", STAGE_COLOR[stage])}>
                        {LEAD_STAGE_LABELS[stage]}
                      </span>
                      <span className="text-[10px] text-gray-400">{items.length}</span>
                    </div>
                    <ul className="space-y-1 mt-1">
                      {items.map((c) => <LeadCard key={c.id} conv={c} active={c.id === selectedId} onSelect={() => setSelectedId(c.id)} />)}
                    </ul>
                  </div>
                );
              })}
              {grouped._unstaged.length > 0 && (
                <div>
                  <div className="px-2 py-1 flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border bg-gray-50 text-gray-400 border-gray-200">Sem stage</span>
                    <span className="text-[10px] text-gray-400">{grouped._unstaged.length}</span>
                  </div>
                  <ul className="space-y-1 mt-1">
                    {grouped._unstaged.map((c) => <LeadCard key={c.id} conv={c} active={c.id === selectedId} onSelect={() => setSelectedId(c.id)} />)}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </aside>

      {/* CENTER — Chat thread */}
      <section className="bg-white border border-gray-200 shadow-sm rounded-xl flex flex-col overflow-hidden min-h-0">
        {selected ? (
          <SalesThread conversation={selected} onChange={loadConversations} />
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
            Selecione um lead
          </div>
        )}
      </section>

      {/* RIGHT — Lead data panel */}
      <aside className="bg-white border border-gray-200 shadow-sm rounded-xl flex flex-col overflow-hidden min-h-0">
        {selected ? <LeadPanel conversation={selected} onChange={loadConversations} /> : null}
      </aside>
    </div>
  );
}

function LeadCard({ conv, active, onSelect }: { conv: SalesConvRow; active: boolean; onSelect: () => void }) {
  const conf = conv.lead_data?.confidence_score;
  return (
    <li>
      <button
        onClick={onSelect}
        className={cn(
          "w-full text-left p-2 rounded-lg flex flex-col gap-0.5 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40",
          active ? "bg-amber-500/10 border border-amber-200" : "hover:bg-gray-50 border border-transparent"
        )}
      >
        <div className="flex items-baseline justify-between gap-2">
          <span className="font-medium text-sm text-gray-900 truncate">
            {conv.contact_name || conv.contact_phone}
          </span>
          <span className="text-[10px] text-gray-400 shrink-0">{formatTime(conv.last_message_at)}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-gray-500 truncate flex-1">
            {conv.last_message_text || "—"}
          </span>
          {conf !== null && conf !== undefined && (
            <span className={cn(
              "text-[10px] font-bold px-1 rounded",
              conf >= 8 ? "bg-emerald-50 text-emerald-700"
                : conf >= 5 ? "bg-amber-50 text-amber-700"
                : "bg-rose-50 text-rose-700"
            )}>{conf}/10</span>
          )}
          {conv.unread_count > 0 && (
            <span className="bg-amber-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center shrink-0">
              {conv.unread_count}
            </span>
          )}
        </div>
      </button>
    </li>
  );
}

function SalesThread({ conversation, onChange }: { conversation: SalesConvRow; onChange: () => void }) {
  const [messages, setMessages] = useState<MsgRow[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const supabase = useMemo(() => createClient(), []);

  // Auto-grow the composer up to max-h-32 (128px); reset when cleared.
  useEffect(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 128) + "px";
  }, [text]);

  const refresh = useCallback(async () => {
    try {
      const msgs = await api<MsgRow[]>(`/api/whatsapp/conversations/${conversation.id}/messages?limit=80`);
      setMessages(msgs);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [conversation.id]);

  useEffect(() => {
    setLoading(true);
    setMessages([]);
    setErr(null);
    refresh();
    fetch(`/api/whatsapp/conversations/${conversation.id}/read`, { method: "POST" })
      .then(onChange)
      .catch(() => null);
  }, [conversation.id, refresh, onChange]);

  useEffect(() => {
    const channel = supabase
      .channel(`sales-msg-${conversation.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "whatsapp_messages", filter: `conversation_id=eq.${conversation.id}` },
        (payload) => {
          const newMsg = payload.new as MsgRow;
          setMessages((prev) => prev.some((m) => m.id === newMsg.id) ? prev : [...prev, newMsg]);
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [supabase, conversation.id]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages.length]);

  const send = async () => {
    if (!text.trim() || sending) return;
    setSending(true);
    setErr(null);
    try {
      await api(`/api/whatsapp/conversations/${conversation.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: text.trim() }),
      });
      setText("");
      onChange();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Falha ao enviar");
    } finally {
      setSending(false);
    }
  };

  if (loading) return <div className="flex-1 flex items-center justify-center text-gray-400"><Loader2 className="animate-spin" size={20} /></div>;

  return (
    <>
      <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-3">
        <Avatar name={conversation.contact_name || conversation.contact_phone} />
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm text-gray-900 truncate">
            {conversation.contact_name || conversation.contact_phone}
          </div>
          <div className="text-[11px] text-gray-500 flex items-center gap-2">
            <span>{conversation.contact_phone}</span>
            {conversation.lead_data?.origem === "prospeccao_fria" && (
              <span className="text-amber-700">· prospecção fria</span>
            )}
          </div>
        </div>
        {!conversation.ai_active && (
          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded bg-rose-50 text-rose-700 border border-rose-200">
            IA pausada
          </span>
        )}
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-2 bg-[#FAF9F5]">
        {messages.length === 0 ? (
          <div className="h-full flex items-center justify-center text-sm text-gray-400">
            Sem mensagens ainda.
          </div>
        ) : (
          messages.map((m, i) => (
            <SalesMessageBubble
              key={m.id}
              message={m}
              showSenderHint={i === 0 || messages[i - 1].direction !== m.direction || messages[i - 1].sender !== m.sender}
            />
          ))
        )}
      </div>

      <div className="p-3 border-t border-gray-100 bg-white">
        {err && <div className="text-xs text-red-500 mb-2 flex items-center gap-1"><AlertCircle size={12} aria-hidden="true" /> {err}</div>}
        {conversation.ai_active && (
          <div className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded px-2 py-1.5 mb-2 flex items-center gap-2">
            <Sparkles size={12} aria-hidden="true" /> IA da Sarah está ativa. Pause antes de enviar uma resposta manual pra evitar duas respostas.
          </div>
        )}
        <AiAssistBar
          conversationId={conversation.id}
          purpose="sales"
          accent="amber"
          onInsert={(t) => setText((prev) => (prev.trim() ? prev + "\n" + t : t))}
        />
        <div className="flex gap-2 items-end">
          <ComposerTools
            accent="amber"
            onInsert={(t) => setText((prev) => prev + t)}
            variables={{
              nome: conversation.contact_name,
              empresa: "Milagres Hospedagens",
              telefone: conversation.contact_phone,
            }}
          />
          <textarea
            ref={taRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            aria-label="Resposta manual"
            placeholder="Resposta manual (Enter envia)"
            rows={1}
            className="flex-1 resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm transition-colors duration-200 focus:outline-none focus:border-amber-500 focus-visible:ring-2 focus-visible:ring-brand-400/40 max-h-32 overflow-y-auto"
          />
          <button
            onClick={send}
            aria-label="Enviar resposta"
            disabled={!text.trim() || sending}
            className="bg-amber-600 hover:bg-amber-700 disabled:bg-gray-200 disabled:text-gray-400 text-white p-2.5 rounded-lg transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40"
          >
            {sending ? <Loader2 className="animate-spin" size={16} aria-hidden="true" /> : <Send size={16} aria-hidden="true" />}
          </button>
        </div>
      </div>
    </>
  );
}

function LeadPanel({ conversation, onChange }: { conversation: SalesConvRow; onChange: () => void }) {
  const lead = conversation.lead_data;
  const [stage, setStage] = useState<LeadStage | "">((lead?.lead_stage as LeadStage) || "");
  const [objetivo, setObjetivo] = useState(lead?.objetivo || "");
  const [orcamento, setOrcamento] = useState(lead?.orcamento || "");
  const [propertyOfInterest, setPropertyOfInterest] = useState(lead?.property_of_interest || "");
  const [closedReason, setClosedReason] = useState(lead?.closed_reason || "");
  const [busy, setBusy] = useState(false);
  const [busyAi, setBusyAi] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);

  useEffect(() => {
    setStage((lead?.lead_stage as LeadStage) || "");
    setObjetivo(lead?.objetivo || "");
    setOrcamento(lead?.orcamento || "");
    setPropertyOfInterest(lead?.property_of_interest || "");
    setClosedReason(lead?.closed_reason || "");
  }, [lead]);

  const save = async () => {
    setBusy(true);
    setErr(null);
    setHint(null);
    try {
      await api(`/api/sales/conversations/${conversation.id}/lead`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lead_stage: stage || null,
          objetivo: objetivo || null,
          orcamento: orcamento || null,
          property_of_interest: propertyOfInterest || null,
          closed_reason: closedReason || null,
        }),
      });
      setHint("Salvo");
      onChange();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Falha ao salvar");
    } finally {
      setBusy(false);
    }
  };

  const toggleAi = async () => {
    setBusyAi(true);
    setErr(null);
    try {
      await api(`/api/sales/conversations/${conversation.id}/ai-control`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: conversation.ai_active ? "pause" : "resume" }),
      });
      onChange();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Falha ao alterar IA");
    } finally {
      setBusyAi(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-gray-100">
        <h3 className="font-semibold text-sm text-gray-900">Dados do Lead</h3>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <button
          onClick={toggleAi}
          disabled={busyAi}
          className={cn(
            "w-full px-3 py-2.5 rounded-lg text-sm font-semibold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40 flex items-center justify-center gap-2 border",
            conversation.ai_active
              ? "bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100"
              : "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
          )}
        >
          {busyAi ? <Loader2 className="animate-spin" size={14} aria-hidden="true" /> : conversation.ai_active ? <BotOff size={14} aria-hidden="true" /> : <Bot size={14} aria-hidden="true" />}
          {conversation.ai_active ? "Pausar IA da Sarah" : "Reativar IA da Sarah"}
        </button>

        {lead && (
          <div className="p-3 rounded-lg bg-gray-50 border border-gray-100 space-y-1.5">
            {lead.confidence_score !== null && (
              <div className="text-xs flex items-center justify-between">
                <span className="text-gray-500">Confiança IA</span>
                <span className="font-semibold">{lead.confidence_score}/10</span>
              </div>
            )}
            {lead.origem && (
              <div className="text-xs flex items-center justify-between">
                <span className="text-gray-500">Origem</span>
                <span className="font-medium">{lead.origem === "prospeccao_fria" ? "Prospecção fria" : "Inbound"}</span>
              </div>
            )}
            {lead.marcelo_handoff_at && (
              <div className="text-xs flex items-center justify-between">
                <span className="text-gray-500">Handoff Marcelo</span>
                <span className="font-medium">{formatTime(lead.marcelo_handoff_at)}</span>
              </div>
            )}
          </div>
        )}

        <div>
          <label className="text-[11px] text-gray-500 uppercase tracking-wider font-semibold">Stage</label>
          <select
            value={stage}
            onChange={(e) => setStage(e.target.value as LeadStage | "")}
            className="w-full mt-1 px-3 py-2 text-sm rounded-lg border border-gray-200 transition-colors duration-200 focus:outline-none focus:border-amber-500 focus-visible:ring-2 focus-visible:ring-brand-400/40 bg-white"
          >
            <option value="">— sem stage —</option>
            {LEAD_STAGE_ORDER.map((s) => (
              <option key={s} value={s}>{LEAD_STAGE_LABELS[s]}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-[11px] text-gray-500 uppercase tracking-wider font-semibold">Objetivo</label>
          <textarea
            value={objetivo}
            onChange={(e) => setObjetivo(e.target.value)}
            rows={2}
            className="w-full mt-1 px-3 py-2 text-sm rounded-lg border border-gray-200 transition-colors duration-200 focus:outline-none focus:border-amber-500 focus-visible:ring-2 focus-visible:ring-brand-400/40"
            placeholder="Ex: Investimento em imóvel litorâneo"
          />
        </div>

        <div>
          <label className="text-[11px] text-gray-500 uppercase tracking-wider font-semibold">Orçamento</label>
          <input
            value={orcamento}
            onChange={(e) => setOrcamento(e.target.value)}
            className="w-full mt-1 px-3 py-2 text-sm rounded-lg border border-gray-200 transition-colors duration-200 focus:outline-none focus:border-amber-500 focus-visible:ring-2 focus-visible:ring-brand-400/40"
            placeholder="Ex: R$ 800k a 1M"
          />
        </div>

        <div>
          <label className="text-[11px] text-gray-500 uppercase tracking-wider font-semibold">Imóvel de interesse</label>
          <input
            value={propertyOfInterest}
            onChange={(e) => setPropertyOfInterest(e.target.value)}
            className="w-full mt-1 px-3 py-2 text-sm rounded-lg border border-gray-200 transition-colors duration-200 focus:outline-none focus:border-amber-500 focus-visible:ring-2 focus-visible:ring-brand-400/40"
            placeholder="Ex: Casa Coral"
          />
        </div>

        {stage === "encerramento" && (
          <div>
            <label className="text-[11px] text-gray-500 uppercase tracking-wider font-semibold">Motivo do encerramento</label>
            <textarea
              value={closedReason}
              onChange={(e) => setClosedReason(e.target.value)}
              rows={2}
              className="w-full mt-1 px-3 py-2 text-sm rounded-lg border border-gray-200 transition-colors duration-200 focus:outline-none focus:border-amber-500 focus-visible:ring-2 focus-visible:ring-brand-400/40"
            />
          </div>
        )}

        {lead?.reasoning && (
          <details className="text-[11px] text-gray-500">
            <summary className="cursor-pointer">Reasoning IA</summary>
            <p className="mt-1 p-2 bg-gray-50 rounded">{lead.reasoning}</p>
          </details>
        )}
      </div>

      <div className="p-3 border-t border-gray-100 bg-white">
        {err && <div className="text-xs text-red-500 mb-1.5 flex items-center gap-1"><AlertCircle size={12} aria-hidden="true" /> {err}</div>}
        {hint && <div className="text-xs text-emerald-600 mb-1.5">{hint}</div>}
        <button
          onClick={save}
          disabled={busy}
          className="w-full bg-amber-600 hover:bg-amber-700 disabled:bg-gray-200 disabled:text-gray-400 text-white px-3 py-2 rounded-lg text-sm font-semibold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40 flex items-center justify-center gap-2"
        >
          {busy ? <Loader2 className="animate-spin" size={14} aria-hidden="true" /> : null}
          Salvar dados do lead
        </button>
      </div>
    </div>
  );
}

function SalesMessageBubble({ message, showSenderHint }: { message: MsgRow; showSenderHint: boolean }) {
  const outbound = message.direction === "outbound";
  const senderTag = outbound
    ? message.sender === "ai" ? "Sarah · IA" : message.sender === "agent" ? "Você (manual)" : "Sistema"
    : "Lead";
  return (
    <div className={cn("flex flex-col", outbound ? "items-end" : "items-start")}>
      {showSenderHint && <span className="text-[10px] text-gray-400 mb-0.5 px-1">{senderTag}</span>}
      <div
        className={cn(
          "max-w-[70%] rounded-2xl px-3 py-2 text-sm shadow-sm",
          outbound
            ? message.sender === "ai"
              ? "bg-amber-50 border border-amber-100 text-amber-900 rounded-br-sm"
              : "bg-amber-600 text-white rounded-br-sm"
            : "bg-white border border-gray-100 text-gray-900 rounded-bl-sm"
        )}
      >
        {message.text && <p className="whitespace-pre-wrap break-words">{message.text}</p>}
        <div className={cn(
          "flex items-center gap-1 justify-end mt-0.5 text-[10px]",
          outbound ? message.sender === "ai" ? "text-amber-600" : "text-white/80" : "text-gray-400"
        )}>
          <span>{formatTimeFull(message.created_at)}</span>
          {outbound && <StatusIcon status={message.status} />}
        </div>
      </div>
    </div>
  );
}

function StatusIcon({ status }: { status: WaMessageStatus }) {
  if (status === "pending") return <Loader2 size={11} className="animate-spin" />;
  if (status === "failed") return <AlertCircle size={11} />;
  if (status === "sent" || status === "delivered" || status === "read") return <CheckCheck size={11} />;
  return null;
}

function Avatar({ name }: { name: string }) {
  const initials = (name || "?").split(/\s+/).slice(0, 2).map((p) => p[0]).join("").toUpperCase();
  return (
    <div className="w-9 h-9 rounded-full bg-amber-500/15 text-amber-700 flex items-center justify-center text-xs font-semibold shrink-0">
      {initials.slice(0, 2)}
    </div>
  );
}
