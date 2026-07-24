"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  Target, Loader2, Search, Bot, BotOff, AlertCircle, Phone, Sparkles,
  LayoutGrid, MessageSquare, ChevronLeft, Maximize2, Minimize2,
  PanelRightClose, PanelRightOpen, List, Hand,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils/cn";
import { FunnelBoard } from "@/components/funnel/funnel-board";
import { FunnelList } from "@/components/funnel/funnel-list";
import { TagPicker } from "@/components/funnel/tag-picker";
import type { Tag } from "@/types/funnel";
import { ChatComposer } from "@/components/chat/chat-composer";
import { MediaContent } from "@/components/chat/media-content";
import { api, formatTime } from "@/lib/chat/utils";
import { Avatar } from "@/components/chat/avatar";
import { StatusIcon } from "@/components/chat/status-icon";
import {
  Database, LeadStage, LEAD_STAGE_ORDER, LEAD_STAGE_LABELS, WaMessageSender, WaMessageDirection,
} from "@/types/database";

type LineRow = Database["public"]["Tables"]["whatsapp_lines"]["Row"];
type ConvRow = Database["public"]["Tables"]["whatsapp_conversations"]["Row"];
type MsgRow = Database["public"]["Tables"]["whatsapp_messages"]["Row"];
type LeadDataRow = Database["public"]["Tables"]["whatsapp_lead_data"]["Row"];
type SalesConvRow = ConvRow & { lead_data: LeadDataRow | null };

const SHELL_HEIGHT = "h-[calc(100dvh-13rem)] min-h-[560px]";

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
        if (!cancelled) setError(err instanceof Error ? err.message : "Falha ao carregar linhas");
      } finally {
        if (!cancelled) setLoadingLines(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (loadingLines) return <div className={cn(SHELL_HEIGHT, "flex items-center justify-center text-gray-400")}><Loader2 className="animate-spin" size={20} /></div>;
  if (error) return <div className={cn(SHELL_HEIGHT, "flex items-center justify-center text-red-500 gap-2 text-sm")}><AlertCircle size={16} /> {error}</div>;
  if (lines.length === 0) {
    return (
      <div className={cn(SHELL_HEIGHT, "flex items-center justify-center")}>
        <div className="text-center max-w-sm">
          <div className="w-12 h-12 rounded-full bg-amber-50 mx-auto flex items-center justify-center mb-3"><Target className="text-amber-600" size={20} /></div>
          <h3 className="font-semibold text-gray-900 mb-1">Nenhuma linha de Vendas conectada</h3>
          <p className="text-sm text-gray-500">Crie uma linha com purpose &quot;sales&quot; e configure o n8n para espelhar as mensagens.</p>
        </div>
      </div>
    );
  }

  const activeLine = lines.find((l) => l.id === activeLineId) || lines[0];
  return <SalesWorkspace lines={lines} activeLine={activeLine} onSwitchLine={setActiveLineId} />;
}

function SalesWorkspace({ lines, activeLine, onSwitchLine }: { lines: LineRow[]; activeLine: LineRow; onSwitchLine: (id: string) => void; }) {
  const [view, setView] = useState<"conversas" | "kanban" | "lista">("conversas");
  const [focusLeadId, setFocusLeadId] = useState<string | null>(null);

  // Chegou de /vendas?conversation=<id> (atalho "abrir conversa" da página
  // Contatos): foca essa conversa e garante que estamos na aba Conversas.
  useEffect(() => {
    const cid = new URLSearchParams(window.location.search).get("conversation");
    if (!cid) return;
    setView("conversas");
    setFocusLeadId(cid);
    window.history.replaceState({}, "", "/vendas");
  }, []);

  return (
    <div className={cn(SHELL_HEIGHT, "flex flex-col gap-3")}>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1 p-1 bg-gray-100/70 rounded-xl">
          {([
            { id: "conversas", label: "Conversas", icon: MessageSquare },
            { id: "kanban", label: "Kanban", icon: LayoutGrid },
            { id: "lista", label: "Lista", icon: List },
          ] as const).map((v) => (
            <button key={v.id} onClick={() => setView(v.id)} aria-pressed={view === v.id}
              className={cn("px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/40 flex items-center gap-1.5",
                view === v.id ? "bg-white shadow-sm text-amber-700" : "text-gray-500 hover:text-gray-700")}>
              <v.icon size={13} /> {v.label}
            </button>
          ))}
        </div>
        {lines.length > 1 && (
          <div className="flex gap-1 p-1 bg-gray-100/70 rounded-xl">
            {lines.map((l) => (
              <button key={l.id} onClick={() => onSwitchLine(l.id)}
                className={cn("px-3 py-1.5 text-xs font-medium rounded-lg transition-colors duration-200 flex items-center gap-1.5",
                  activeLine.id === l.id ? "bg-white shadow-sm text-amber-700" : "text-gray-500 hover:text-gray-700")}>
                <Phone size={11} /> {l.label}<span className="text-[10px] text-gray-400 font-normal">{l.phone}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {view === "kanban" || view === "lista" ? (
        <div className="flex-1 border border-gray-200 rounded-2xl bg-white shadow-sm overflow-hidden min-h-0 p-3 flex flex-col">
          {view === "lista" ? (
            <FunnelList
              type="vendas"
              onOpenDeal={(deal) => {
                if (deal.conversation_id) { setFocusLeadId(deal.conversation_id); setView("conversas"); }
              }}
            />
          ) : (
            <FunnelBoard
              type="vendas"
              onOpenDeal={(deal) => {
                if (deal.conversation_id) { setFocusLeadId(deal.conversation_id); setView("conversas"); }
              }}
            />
          )}
        </div>
      ) : (
        <div className="flex-1 flex border border-gray-200 rounded-2xl bg-white shadow-sm overflow-hidden min-h-0">
          <SalesPipeline lineId={activeLine.id} focusLeadId={focusLeadId} />
        </div>
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
  const [onlyHandoff, setOnlyHandoff] = useState(false);
  const [mobileThread, setMobileThread] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [panelOpen, setPanelOpen] = useState(true);
  const supabase = useMemo(() => createClient(), []);
  const refetchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadConversations = useCallback(async () => {
    try {
      const data = await api<SalesConvRow[]>(`/api/sales/conversations?line_id=${lineId}`);
      setConversations(data);
      setSelectedId((cur) => cur ?? (data.length > 0 ? data[0].id : null));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao carregar");
    } finally { setLoading(false); }
  }, [lineId]);

  useEffect(() => { setLoading(true); setSelectedId(null); loadConversations(); }, [lineId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (focusLeadId) { setSelectedId(focusLeadId); setMobileThread(true); } }, [focusLeadId]);

  useEffect(() => {
    const bump = () => { if (refetchTimer.current) clearTimeout(refetchTimer.current); refetchTimer.current = setTimeout(() => loadConversations(), 600); };
    const ch1 = supabase
      .channel(`sales-conv-${lineId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "whatsapp_conversations", filter: `line_id=eq.${lineId}` }, bump)
      .on("postgres_changes", { event: "*", schema: "public", table: "whatsapp_lead_data" }, bump)
      .subscribe();
    return () => { if (refetchTimer.current) clearTimeout(refetchTimer.current); supabase.removeChannel(ch1); };
  }, [supabase, lineId, loadConversations]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return conversations.filter((c) => {
      if (onlyHandoff && !c.lead_data?.marcelo_handoff_at) return false;
      if (!q) return true;
      return (c.contact_name || "").toLowerCase().includes(q) || (c.contact_phone || "").includes(q) || (c.lead_data?.objetivo || "").toLowerCase().includes(q);
    });
  }, [conversations, search, onlyHandoff]);

  const grouped = useMemo(() => {
    const buckets: Record<LeadStage | "_unstaged", SalesConvRow[]> = {
      apresentacao: [], qualificacao_objetivo: [], qualificacao_orcamento: [], apresentacao_imoveis: [], handoff: [], encerramento: [], _unstaged: [],
    };
    for (const c of filtered) {
      const stage = c.lead_data?.lead_stage as LeadStage | undefined;
      if (stage && stage in buckets) buckets[stage].push(c); else buckets._unstaged.push(c);
    }
    return buckets;
  }, [filtered]);

  const selected = conversations.find((c) => c.id === selectedId) || null;
  const totalUnread = conversations.reduce((a, c) => a + (c.unread_count || 0), 0);
  const handoffCount = conversations.filter((c) => c.lead_data?.marcelo_handoff_at).length;
  const select = (id: string) => { setSelectedId(id); setMobileThread(true); };

  return (
    <>
      {/* Pipeline list grouped by stage */}
      <aside className={cn("w-full lg:w-[330px] xl:w-[370px] shrink-0 border-r border-gray-200 flex-col min-h-0 bg-gray-50/40", mobileThread ? "hidden" : "flex", focusMode ? "lg:hidden" : "lg:flex")}>
        <div className="p-3 border-b border-gray-100 bg-white space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-bold text-gray-800">Leads</h2>
            <div className="flex items-center gap-1.5">
              {handoffCount > 0 && (
                <button
                  onClick={() => setOnlyHandoff((v) => !v)}
                  title="Conversas que a IA passou para um humano — clique para filtrar"
                  className={cn(
                    "inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border transition-colors duration-150",
                    onlyHandoff ? "bg-rose-600 text-white border-rose-600" : "bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100"
                  )}
                >
                  <Hand size={11} /> {handoffCount} handoff
                </button>
              )}
              {totalUnread > 0 && <span className="text-[10px] font-bold text-amber-700 bg-amber-500/10 px-2 py-0.5 rounded-full">{totalUnread} não lidas</span>}
            </div>
          </div>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden="true" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Buscar lead, telefone, objetivo" placeholder="Buscar lead, objetivo…"
              className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-gray-200 bg-gray-50 transition-colors duration-200 focus:outline-none focus:border-amber-500 focus:bg-white focus-visible:ring-2 focus-visible:ring-amber-400/40" />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto scrollbar-thin">
          {loading ? <div className="p-4 flex justify-center text-gray-400"><Loader2 className="animate-spin" size={16} /></div>
            : error ? <div className="p-4 text-sm text-red-500">{error}</div>
            : conversations.length === 0 ? <div className="p-8 text-center text-sm text-gray-400">Nenhum lead ainda. Quando alguém escrever no WhatsApp de Vendas, aparece aqui.</div>
            : (
              <div className="space-y-3 p-2">
                {LEAD_STAGE_ORDER.map((stage) => {
                  const items = grouped[stage];
                  if (items.length === 0) return null;
                  return (
                    <div key={stage}>
                      <div className="px-2 py-1 flex items-center gap-2">
                        <span className={cn("text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border", STAGE_COLOR[stage])}>{LEAD_STAGE_LABELS[stage]}</span>
                        <span className="text-[10px] text-gray-400">{items.length}</span>
                      </div>
                      <ul className="space-y-1 mt-1">{items.map((c) => <LeadCard key={c.id} conv={c} active={c.id === selectedId} onSelect={() => select(c.id)} />)}</ul>
                    </div>
                  );
                })}
                {grouped._unstaged.length > 0 && (
                  <div>
                    <div className="px-2 py-1 flex items-center gap-2"><span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border bg-gray-50 text-gray-400 border-gray-200">Sem stage</span><span className="text-[10px] text-gray-400">{grouped._unstaged.length}</span></div>
                    <ul className="space-y-1 mt-1">{grouped._unstaged.map((c) => <LeadCard key={c.id} conv={c} active={c.id === selectedId} onSelect={() => select(c.id)} />)}</ul>
                  </div>
                )}
              </div>
            )}
        </div>
      </aside>

      {/* Thread */}
      <section className={cn("flex-1 flex-col min-w-0 min-h-0", mobileThread ? "flex" : "hidden lg:flex")}>
        {selected ? (
          <SalesThread conversation={selected} onChange={loadConversations} onBackMobile={() => setMobileThread(false)}
            focusMode={focusMode} onToggleFocus={() => setFocusMode((v) => !v)} panelOpen={panelOpen} onTogglePanel={() => setPanelOpen((v) => !v)} />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-400 gap-3"><div className="w-14 h-14 rounded-full bg-amber-500/10 flex items-center justify-center"><Target className="text-amber-500" size={24} /></div><p className="text-sm">Selecione um lead</p></div>
        )}
      </section>

      {/* Lead panel */}
      <aside className={cn("w-[330px] shrink-0 border-l border-gray-200 flex-col min-h-0 bg-gray-50/40", panelOpen ? "hidden xl:flex" : "hidden")}>
        {selected ? <LeadPanel conversation={selected} onChange={loadConversations} /> : null}
      </aside>
    </>
  );
}

function LeadCard({ conv, active, onSelect }: { conv: SalesConvRow; active: boolean; onSelect: () => void }) {
  const conf = conv.lead_data?.confidence_score;
  const name = conv.contact_name || conv.contact_phone;
  return (
    <li>
      <button onClick={onSelect}
        className={cn("w-full text-left p-2 rounded-lg flex items-start gap-2.5 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/40",
          active ? "bg-amber-500/10 border border-amber-200" : "hover:bg-white border border-transparent")}>
        <Avatar name={name} accent="amber" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className={cn("text-sm truncate flex-1", conv.unread_count > 0 ? "font-bold text-gray-900" : "font-medium text-gray-800")}>{name}</span>
            <span className="text-[10px] text-gray-400 shrink-0">{formatTime(conv.last_message_at)}</span>
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className={cn("text-[11px] truncate flex-1", conv.unread_count > 0 ? "text-gray-700" : "text-gray-500")}>{conv.last_message_text || "—"}</span>
            {conv.lead_data?.marcelo_handoff_at && (
              <span className="inline-flex items-center gap-0.5 bg-rose-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0" title="Handoff — a IA passou para um humano">
                <Hand size={9} /> handoff
              </span>
            )}
            {conf !== null && conf !== undefined && (
              <span className={cn("text-[10px] font-bold px-1 rounded", conf >= 8 ? "bg-emerald-50 text-emerald-700" : conf >= 5 ? "bg-amber-50 text-amber-700" : "bg-rose-50 text-rose-700")}>{conf}/10</span>
            )}
            {conv.unread_count > 0 && <span className="bg-amber-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center shrink-0">{conv.unread_count}</span>}
          </div>
        </div>
      </button>
    </li>
  );
}

function dayLabel(iso: string): string {
  const d = new Date(iso); const today = new Date();
  if (d.toDateString() === today.toDateString()) return "Hoje";
  const y = new Date(today.getTime() - 86_400_000);
  if (d.toDateString() === y.toDateString()) return "Ontem";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: d.getFullYear() === today.getFullYear() ? undefined : "numeric" });
}

function SalesThread({ conversation, onChange, onBackMobile, focusMode, onToggleFocus, panelOpen, onTogglePanel }: {
  conversation: SalesConvRow; onChange: () => void; onBackMobile: () => void;
  focusMode: boolean; onToggleFocus: () => void; panelOpen: boolean; onTogglePanel: () => void;
}) {
  const [messages, setMessages] = useState<MsgRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const supabase = useMemo(() => createClient(), []);

  const refresh = useCallback(async () => {
    try { setMessages(await api<MsgRow[]>(`/api/whatsapp/conversations/${conversation.id}/messages?limit=80`)); }
    catch (e) { setErr(e instanceof Error ? e.message : "Falha ao carregar"); }
    finally { setLoading(false); }
  }, [conversation.id]);

  useEffect(() => {
    setLoading(true); setMessages([]); setErr(null); refresh();
    fetch(`/api/whatsapp/conversations/${conversation.id}/read`, { method: "POST" }).then(onChange).catch(() => null);
  }, [conversation.id, refresh, onChange]);

  useEffect(() => {
    const channel = supabase
      .channel(`sales-msg-${conversation.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "whatsapp_messages", filter: `conversation_id=eq.${conversation.id}` }, (payload) => {
        if (payload.eventType === "INSERT") { const m = payload.new as MsgRow; setMessages((prev) => prev.some((x) => x.id === m.id) ? prev.map((x) => x.id === m.id ? m : x) : [...prev, m]); }
        else if (payload.eventType === "UPDATE") { const m = payload.new as MsgRow; setMessages((prev) => prev.map((x) => x.id === m.id ? m : x)); }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [supabase, conversation.id]);

  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [messages.length]);

  if (loading) return <div className="flex-1 flex items-center justify-center text-gray-400"><Loader2 className="animate-spin" size={20} /></div>;

  const name = conversation.contact_name || conversation.contact_phone;
  const groups: { date: string; items: MsgRow[] }[] = [];
  for (const m of messages) {
    const key = new Date(m.created_at).toDateString();
    const last = groups[groups.length - 1];
    if (last && last.date === key) last.items.push(m); else groups.push({ date: key, items: [m] });
  }

  return (
    <>
      <div className="px-3 lg:px-5 h-16 border-b border-gray-100 flex items-center gap-3 bg-white shrink-0">
        <button onClick={onBackMobile} aria-label="Voltar" className="lg:hidden p-1.5 -ml-1 rounded-lg text-gray-500 hover:bg-gray-100"><ChevronLeft size={20} /></button>
        <Avatar name={name} accent="amber" />
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm text-gray-900 truncate">{name}</div>
          <div className="text-[11px] text-gray-500 flex items-center gap-2">
            <span className="truncate">{conversation.contact_phone}</span>
            {conversation.lead_data?.origem === "prospeccao_fria" && <span className="text-amber-700 shrink-0">· prospecção fria</span>}
          </div>
        </div>
        <span className={cn("inline-flex items-center gap-1 px-2 h-7 rounded-lg text-xs font-semibold", conversation.ai_active ? "bg-amber-500/10 text-amber-700" : "bg-gray-100 text-gray-500")}>
          {conversation.ai_active ? <Bot size={14} /> : <BotOff size={14} />}<span className="hidden sm:inline">{conversation.ai_active ? "Sarah ativa" : "IA pausada"}</span>
        </span>
        <div className="hidden lg:block w-px h-6 bg-gray-200 mx-0.5" />
        <button onClick={onToggleFocus} title={focusMode ? "Mostrar lista" : "Expandir conversa"} aria-label="Expandir" className="hidden lg:inline-flex p-2 rounded-lg text-gray-400 hover:bg-gray-100 transition-colors duration-200">{focusMode ? <Minimize2 size={16} /> : <Maximize2 size={16} />}</button>
        <button onClick={onTogglePanel} title={panelOpen ? "Ocultar lead" : "Mostrar lead"} aria-label="Painel" className={cn("hidden xl:inline-flex p-2 rounded-lg transition-colors duration-200", panelOpen ? "bg-amber-500/10 text-amber-700" : "text-gray-400 hover:bg-gray-100")}>{panelOpen ? <PanelRightClose size={16} /> : <PanelRightOpen size={16} />}</button>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 lg:px-6 lg:py-5 space-y-1 bg-gradient-to-b from-amber-50/40 to-white scrollbar-thin">
        {messages.length === 0 ? <div className="h-full flex items-center justify-center text-sm text-gray-400">Sem mensagens ainda.</div>
          : groups.map((g) => (
            <div key={g.date} className="space-y-1.5">
              <div className="flex justify-center py-2"><span className="text-[10px] font-medium uppercase tracking-wide text-gray-500 bg-white/90 backdrop-blur border border-gray-200 px-3 py-1 rounded-full shadow-sm">{dayLabel(g.items[0].created_at)}</span></div>
              {g.items.map((m, i) => <SalesBubble key={m.id} message={m} grouped={i > 0 && g.items[i - 1].direction === m.direction && g.items[i - 1].sender === m.sender} />)}
            </div>
          ))}
      </div>

      {err && <div className="px-3 pt-2 text-xs text-red-500 flex items-center gap-1 bg-white"><AlertCircle size={12} aria-hidden="true" /> {err}</div>}
      <ChatComposer
        conversationId={conversation.id}
        purpose="sales"
        accent="amber"
        contactName={conversation.contact_name}
        contactPhone={conversation.contact_phone}
        aiActive={conversation.ai_active}
        onSent={() => { refresh(); onChange(); }}
      />
    </>
  );
}

function SalesBubble({ message, grouped }: { message: MsgRow; grouped: boolean }) {
  const outbound = message.direction === "outbound";
  const isAi = outbound && message.sender === "ai";
  return (
    <div className={cn("flex flex-col", outbound ? "items-end" : "items-start", grouped ? "mt-0.5" : "mt-2")}>
      {!grouped && <span className="text-[10px] text-gray-400 mb-0.5 px-1">{senderLabel(message.sender, message.direction)}</span>}
      <div className={cn("max-w-[80%] md:max-w-[68%] rounded-2xl px-3.5 py-2 text-sm shadow-sm",
        outbound ? isAi ? "bg-amber-50 border border-amber-200 text-amber-900 rounded-br-md" : "bg-amber-600 text-white rounded-br-md" : "bg-white border border-gray-200 text-gray-900 rounded-bl-md")}>
        {isAi && <span className="flex items-center gap-1 mb-1 text-[9px] uppercase font-bold tracking-wide text-amber-600"><Sparkles size={11} /> Sarah · IA</span>}
        {message.media_url && message.message_type !== "text" && (
          <MediaContent
            type={message.message_type}
            url={message.media_url}
            mime={message.media_mime_type}
            fileName={message.file_name}
            tone={outbound && !isAi ? "sent" : "neutral"}
          />
        )}
        {message.text && <p className="whitespace-pre-wrap break-words leading-snug">{message.text}</p>}
        <div className={cn("flex items-center gap-1 justify-end mt-0.5 text-[10px]", outbound ? (isAi ? "text-amber-600" : "text-white/80") : "text-gray-400")}>
          <span>{new Date(message.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
          {outbound && <StatusIcon status={message.status} />}
        </div>
      </div>
    </div>
  );
}

function senderLabel(sender: WaMessageSender, direction: WaMessageDirection): string {
  if (direction === "inbound") return "Lead";
  if (sender === "ai") return "Sarah · IA";
  if (sender === "agent") return "Você (manual)";
  if (sender === "system") return "Sistema";
  return "";
}

/** Tags da conversa (tabela conversation_tags) — mesmo esquema de tags do funil. */
function ConversationTags({ conversationId }: { conversationId: string }) {
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api<Tag[]>(`/api/whatsapp/conversations/${conversationId}/tags`)
      .then((tags) => { if (!cancelled) setTagIds(tags.map((t) => t.id)); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [conversationId]);

  async function apply(ids: string[]) {
    setTagIds(ids);
    setSaving(true);
    try {
      await api(`/api/whatsapp/conversations/${conversationId}/tags`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tag_ids: ids }),
      });
    } catch {
      /* PUT best-effort; o próximo GET reflete o estado real */
    } finally {
      setSaving(false);
    }
  }

  return <TagPicker type="vendas" value={tagIds} onChange={apply} triggerLabel={saving ? "Salvando…" : "Adicionar tags"} />;
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
    setStage((lead?.lead_stage as LeadStage) || ""); setObjetivo(lead?.objetivo || ""); setOrcamento(lead?.orcamento || "");
    setPropertyOfInterest(lead?.property_of_interest || ""); setClosedReason(lead?.closed_reason || "");
  }, [lead]);

  const save = async () => {
    setBusy(true); setErr(null); setHint(null);
    try {
      await api(`/api/sales/conversations/${conversation.id}/lead`, { method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lead_stage: stage || null, objetivo: objetivo || null, orcamento: orcamento || null, property_of_interest: propertyOfInterest || null, closed_reason: closedReason || null }) });
      setHint("Salvo"); onChange();
    } catch (e) { setErr(e instanceof Error ? e.message : "Falha ao salvar"); }
    finally { setBusy(false); }
  };

  const toggleAi = async () => {
    setBusyAi(true); setErr(null);
    try {
      await api(`/api/sales/conversations/${conversation.id}/ai-control`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: conversation.ai_active ? "pause" : "resume" }) });
      onChange();
    } catch (e) { setErr(e instanceof Error ? e.message : "Falha ao alterar IA"); }
    finally { setBusyAi(false); }
  };

  const inputCls = "w-full mt-1 px-3 py-2 text-sm rounded-lg border border-gray-200 transition-colors duration-200 focus:outline-none focus:border-amber-500 focus-visible:ring-2 focus-visible:ring-amber-400/40";

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 h-16 flex items-center border-b border-gray-100 bg-white shrink-0"><h3 className="font-semibold text-sm text-gray-900">Dados do Lead</h3></div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin">
        <button onClick={toggleAi} disabled={busyAi}
          className={cn("w-full px-3 py-2.5 rounded-lg text-sm font-semibold transition-colors duration-200 flex items-center justify-center gap-2 border",
            conversation.ai_active ? "bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100" : "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100")}>
          {busyAi ? <Loader2 className="animate-spin" size={14} /> : conversation.ai_active ? <BotOff size={14} /> : <Bot size={14} />}
          {conversation.ai_active ? "Pausar IA da Sarah" : "Reativar IA da Sarah"}
        </button>

        {lead && (
          <div className="p-3 rounded-lg bg-gray-50 border border-gray-100 space-y-1.5">
            {lead.confidence_score !== null && <div className="text-xs flex items-center justify-between"><span className="text-gray-500">Confiança IA</span><span className="font-semibold">{lead.confidence_score}/10</span></div>}
            {lead.origem && <div className="text-xs flex items-center justify-between"><span className="text-gray-500">Origem</span><span className="font-medium">{lead.origem === "prospeccao_fria" ? "Prospecção fria" : "Inbound"}</span></div>}
            {lead.marcelo_handoff_at && <div className="text-xs flex items-center justify-between"><span className="text-gray-500">Handoff Marcelo</span><span className="font-medium">{formatTime(lead.marcelo_handoff_at)}</span></div>}
          </div>
        )}

        <div><label className="text-[11px] text-gray-500 uppercase tracking-wider font-semibold">Tags da conversa</label>
          <div className="mt-1"><ConversationTags conversationId={conversation.id} /></div>
        </div>

        <div><label className="text-[11px] text-gray-500 uppercase tracking-wider font-semibold">Stage</label>
          <select value={stage} onChange={(e) => setStage(e.target.value as LeadStage | "")} className={cn(inputCls, "bg-white")}>
            <option value="">— sem stage —</option>{LEAD_STAGE_ORDER.map((s) => <option key={s} value={s}>{LEAD_STAGE_LABELS[s]}</option>)}
          </select>
        </div>
        <div><label className="text-[11px] text-gray-500 uppercase tracking-wider font-semibold">Objetivo</label>
          <textarea value={objetivo} onChange={(e) => setObjetivo(e.target.value)} rows={2} className={inputCls} placeholder="Ex: Investimento em imóvel litorâneo" /></div>
        <div><label className="text-[11px] text-gray-500 uppercase tracking-wider font-semibold">Orçamento</label>
          <input value={orcamento} onChange={(e) => setOrcamento(e.target.value)} className={inputCls} placeholder="Ex: R$ 800k a 1M" /></div>
        <div><label className="text-[11px] text-gray-500 uppercase tracking-wider font-semibold">Imóvel de interesse</label>
          <input value={propertyOfInterest} onChange={(e) => setPropertyOfInterest(e.target.value)} className={inputCls} placeholder="Ex: Casa Coral" /></div>
        {stage === "encerramento" && (
          <div><label className="text-[11px] text-gray-500 uppercase tracking-wider font-semibold">Motivo do encerramento</label>
            <textarea value={closedReason} onChange={(e) => setClosedReason(e.target.value)} rows={2} className={inputCls} /></div>
        )}
        {lead?.reasoning && <details className="text-[11px] text-gray-500"><summary className="cursor-pointer">Reasoning IA</summary><p className="mt-1 p-2 bg-gray-50 rounded">{lead.reasoning}</p></details>}
      </div>
      <div className="p-3 border-t border-gray-100 bg-white">
        {err && <div className="text-xs text-red-500 mb-1.5 flex items-center gap-1"><AlertCircle size={12} /> {err}</div>}
        {hint && <div className="text-xs text-emerald-600 mb-1.5">{hint}</div>}
        <button onClick={save} disabled={busy} className="w-full bg-amber-600 hover:bg-amber-700 disabled:bg-gray-200 disabled:text-gray-400 text-white px-3 py-2 rounded-lg text-sm font-semibold transition-colors duration-200 flex items-center justify-center gap-2">{busy ? <Loader2 className="animate-spin" size={14} /> : null} Salvar dados do lead</button>
      </div>
    </div>
  );
}
