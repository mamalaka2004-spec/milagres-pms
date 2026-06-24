"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  MessageSquare, Loader2, Search, Pin, PinOff, Star, Bot, BotOff,
  Phone, AlertCircle, ChevronLeft, Play, Maximize2, Minimize2,
  PanelRightClose, PanelRightOpen,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils/cn";
import { ChatComposer } from "@/components/chat/chat-composer";
import { MediaContent } from "@/components/chat/media-content";
import { ContactPanel } from "@/components/whatsapp/contact-panel";
import { api, formatTime } from "@/lib/chat/utils";
import { Avatar } from "@/components/chat/avatar";
import { StatusIcon } from "@/components/chat/status-icon";
import type {
  Database, WaMessageDirection, WaMessageSender,
} from "@/types/database";

type LineRow = Database["public"]["Tables"]["whatsapp_lines"]["Row"];
type ConvRow = Database["public"]["Tables"]["whatsapp_conversations"]["Row"] & {
  important?: boolean | null;
};
type MsgRow = Database["public"]["Tables"]["whatsapp_messages"]["Row"];

const SHELL_HEIGHT = "h-[calc(100dvh-12rem)] min-h-[560px]";

export function WhatsappShell() {
  const [lines, setLines] = useState<LineRow[]>([]);
  const [activeLineId, setActiveLineId] = useState<string | null>(null);
  const [loadingLines, setLoadingLines] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await api<LineRow[]>("/api/whatsapp/lines");
        if (cancelled) return;
        setLines(data);
        if (data.length > 0) setActiveLineId(data[0].id);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Falha ao carregar linhas");
      } finally {
        if (!cancelled) setLoadingLines(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (loadingLines) {
    return <div className={cn(SHELL_HEIGHT, "flex items-center justify-center text-gray-400")}><Loader2 className="animate-spin" size={20} /></div>;
  }
  if (error) {
    return <div className={cn(SHELL_HEIGHT, "flex items-center justify-center text-red-500 gap-2 text-sm")}><AlertCircle size={16} /> {error}</div>;
  }
  if (lines.length === 0) {
    return <div className={cn(SHELL_HEIGHT, "flex items-center justify-center")}><EmptyLines /></div>;
  }

  const activeLine = lines.find((l) => l.id === activeLineId) || lines[0];

  return (
    <div className={cn(SHELL_HEIGHT, "flex flex-col gap-3")}>
      {lines.length > 1 && (
        <LinePicker lines={lines} activeId={activeLine.id} onSelect={setActiveLineId} />
      )}
      <div className="flex-1 flex border border-gray-200 rounded-2xl bg-white shadow-sm overflow-hidden min-h-0">
        <ChatWorkspace lineId={activeLine.id} />
      </div>
    </div>
  );
}

function EmptyLines() {
  return (
    <div className="text-center max-w-sm">
      <div className="w-12 h-12 rounded-full bg-brand-500/10 mx-auto flex items-center justify-center mb-3">
        <MessageSquare className="text-brand-600" size={20} aria-hidden="true" />
      </div>
      <h3 className="font-semibold text-gray-900 mb-1">Nenhuma linha conectada</h3>
      <p className="text-sm text-gray-500">Conecte um número em Ajustes → WhatsApp.</p>
    </div>
  );
}

function LinePicker({ lines, activeId, onSelect }: { lines: LineRow[]; activeId: string; onSelect: (id: string) => void; }) {
  return (
    <div className="flex gap-1 p-1 bg-gray-100/70 rounded-xl self-start">
      {lines.map((l) => (
        <button
          key={l.id}
          onClick={() => onSelect(l.id)}
          className={cn(
            "px-3 py-1.5 text-xs font-medium rounded-lg transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40 flex items-center gap-1.5",
            activeId === l.id ? "bg-white shadow-sm text-brand-600" : "text-gray-500 hover:text-gray-700"
          )}
        >
          <Phone size={11} aria-hidden="true" /> {l.label}
          <span className="text-[10px] text-gray-400 font-normal">{l.phone}</span>
        </button>
      ))}
    </div>
  );
}

/* ─────────────────────── Workspace (3 panes) ─────────────────────── */

function ChatWorkspace({ lineId }: { lineId: string }) {
  const [conversations, setConversations] = useState<ConvRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "unread" | "open" | "closed">("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mobileThread, setMobileThread] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [panelOpen, setPanelOpen] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const supabase = useMemo(() => createClient(), []);
  const refetchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadConversations = useCallback(async () => {
    try {
      const params = new URLSearchParams({ line_id: lineId });
      if (filter === "unread") params.set("unread", "1");
      if (filter === "open") params.set("status", "open");
      if (filter === "closed") params.set("status", "closed");
      if (search.trim()) params.set("q", search.trim());
      const data = await api<ConvRow[]>(`/api/whatsapp/conversations?${params}`);
      setConversations(data);
      setSelectedId((cur) => cur ?? (data.length > 0 ? data[0].id : null));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao carregar");
    } finally {
      setLoading(false);
    }
  }, [lineId, filter, search]);

  useEffect(() => { setLoading(true); setSelectedId(null); loadConversations(); }, [lineId, filter]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const t = setTimeout(loadConversations, 250); return () => clearTimeout(t); }, [search]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const channel = supabase
      .channel(`wa-conv-${lineId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "whatsapp_conversations", filter: `line_id=eq.${lineId}` }, () => {
        if (refetchTimer.current) clearTimeout(refetchTimer.current);
        refetchTimer.current = setTimeout(() => loadConversations(), 600);
      })
      .subscribe();
    return () => { if (refetchTimer.current) clearTimeout(refetchTimer.current); supabase.removeChannel(channel); };
  }, [supabase, lineId, loadConversations]);

  const selectedConv = conversations.find((c) => c.id === selectedId) || null;
  const totalUnread = conversations.reduce((a, c) => a + (c.unread_count || 0), 0);

  const select = (id: string) => { setSelectedId(id); setMobileThread(true); };

  return (
    <>
      {/* ── Conversation list ── */}
      <aside className={cn("w-full lg:w-[330px] xl:w-[370px] shrink-0 border-r border-gray-200 flex-col min-h-0 bg-gray-50/40", mobileThread ? "hidden" : "flex", focusMode ? "lg:hidden" : "lg:flex")}>
        <div className="p-3 border-b border-gray-100 space-y-2.5 bg-white">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-gray-800">Conversas</h2>
            {totalUnread > 0 && (
              <span className="text-[10px] font-bold text-brand-600 bg-brand-500/10 px-2 py-0.5 rounded-full">{totalUnread} não lidas</span>
            )}
          </div>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden="true" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Buscar por nome ou número"
              placeholder="Buscar conversa…"
              className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-gray-200 bg-gray-50 transition-colors duration-200 focus:outline-none focus:border-brand-500 focus:bg-white focus-visible:ring-2 focus-visible:ring-brand-400/40"
            />
          </div>
          <div className="flex gap-1">
            {([["all", "Todas"], ["unread", "Não lidas"], ["open", "Abertas"], ["closed", "Fechadas"]] as const).map(([id, lbl]) => (
              <button
                key={id}
                onClick={() => setFilter(id)}
                className={cn(
                  "px-2.5 py-1 text-[11px] rounded-full font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40",
                  filter === id ? "bg-brand-500 text-white" : "text-gray-500 hover:bg-gray-100"
                )}
              >{lbl}</button>
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto scrollbar-thin">
          {loading ? (
            <div className="p-4 flex justify-center text-gray-400"><Loader2 className="animate-spin" size={16} /></div>
          ) : error ? (
            <div className="p-4 text-sm text-red-500">{error}</div>
          ) : conversations.length === 0 ? (
            <div className="p-8 text-center text-sm text-gray-400">Nenhuma conversa</div>
          ) : (
            <ul>
              {conversations.map((c) => (
                <ConversationItem key={c.id} conv={c} active={selectedId === c.id} onClick={() => select(c.id)} />
              ))}
            </ul>
          )}
        </div>
      </aside>

      {/* ── Thread ── */}
      <section className={cn("flex-1 flex-col min-w-0 min-h-0", mobileThread ? "flex" : "hidden lg:flex")}>
        {selectedId ? (
          <ConversationView
            conversationId={selectedId}
            onConversationChange={loadConversations}
            onBackMobile={() => setMobileThread(false)}
            focusMode={focusMode}
            onToggleFocus={() => setFocusMode((v) => !v)}
            panelOpen={panelOpen}
            onTogglePanel={() => setPanelOpen((v) => !v)}
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-400 gap-3">
            <div className="w-14 h-14 rounded-full bg-brand-500/10 flex items-center justify-center"><MessageSquare className="text-brand-500" size={24} /></div>
            <p className="text-sm">Selecione uma conversa</p>
          </div>
        )}
      </section>

      {/* ── Contact panel ── */}
      <aside className={cn("w-[330px] shrink-0 border-l border-gray-200 flex-col min-h-0 bg-gray-50/40", panelOpen ? "hidden xl:flex" : "hidden")}>
        {selectedConv ? (
          <ContactPanel conversation={selectedConv} onChange={loadConversations} />
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-300 text-sm p-4 text-center">Selecione uma conversa para ver o contato</div>
        )}
      </aside>
    </>
  );
}

function AiChip({ active }: { active: boolean }) {
  return (
    <span className={cn(
      "inline-flex items-center gap-1 rounded-full border px-1.5 h-[18px] text-[9px] font-semibold shrink-0",
      active ? "bg-brand-500/10 text-brand-600 border-brand-500/30" : "bg-gray-100 text-gray-400 border-gray-200"
    )}>
      {active ? <Bot size={10} /> : <BotOff size={10} />}
      {active ? "IA" : "Manual"}
    </span>
  );
}

function ConversationItem({ conv, active, onClick }: { conv: ConvRow; active: boolean; onClick: () => void }) {
  const name = conv.contact_name || conv.contact_phone;
  return (
    <li>
      <button
        onClick={onClick}
        className={cn(
          "w-full text-left px-3 py-2.5 flex items-start gap-2.5 border-l-2 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-400/40",
          active ? "bg-white border-brand-500" : "border-transparent hover:bg-white/70"
        )}
      >
        <Avatar name={name} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className={cn("text-sm truncate flex-1", conv.unread_count > 0 ? "font-bold text-gray-900" : "font-medium text-gray-800")}>{name}</span>
            <AiChip active={!!conv.ai_active} />
            <span className="text-[10px] text-gray-400 shrink-0">{formatTime(conv.last_message_at)}</span>
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className={cn("text-xs truncate flex-1", conv.unread_count > 0 ? "text-gray-700" : "text-gray-500")}>{conv.last_message_text || "—"}</span>
            {conv.important && <Star size={11} className="text-amber-500 fill-amber-500 shrink-0" aria-hidden="true" />}
            {conv.pinned && <Pin size={11} className="text-brand-500 shrink-0" aria-hidden="true" />}
            {conv.unread_count > 0 && (
              <span className="bg-brand-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center shrink-0">{conv.unread_count}</span>
            )}
          </div>
        </div>
      </button>
    </li>
  );
}

/* ─────────────────────── Single conversation thread ─────────────────────── */

function dayLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return "Hoje";
  const yest = new Date(today.getTime() - 86_400_000);
  if (d.toDateString() === yest.toDateString()) return "Ontem";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: d.getFullYear() === today.getFullYear() ? undefined : "numeric" });
}

function ConversationView({ conversationId, onConversationChange, onBackMobile, focusMode, onToggleFocus, panelOpen, onTogglePanel }: {
  conversationId: string; onConversationChange: () => void; onBackMobile: () => void;
  focusMode: boolean; onToggleFocus: () => void; panelOpen: boolean; onTogglePanel: () => void;
}) {
  const [conversation, setConversation] = useState<ConvRow | null>(null);
  const [messages, setMessages] = useState<MsgRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const supabase = useMemo(() => createClient(), []);

  const refresh = useCallback(async () => {
    try {
      const [c, msgs] = await Promise.all([
        api<ConvRow>(`/api/whatsapp/conversations/${conversationId}`),
        api<MsgRow[]>(`/api/whatsapp/conversations/${conversationId}/messages?limit=80`),
      ]);
      setConversation(c);
      setMessages(msgs);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Falha ao carregar");
    } finally {
      setLoading(false);
    }
  }, [conversationId]);

  useEffect(() => { setLoading(true); setMessages([]); setConversation(null); setErr(null); refresh(); }, [conversationId, refresh]);

  useEffect(() => {
    if (!conversationId) return;
    fetch(`/api/whatsapp/conversations/${conversationId}/read`, { method: "POST" }).then(onConversationChange).catch(() => null);
  }, [conversationId, onConversationChange]);

  useEffect(() => {
    const channel = supabase
      .channel(`wa-msg-${conversationId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "whatsapp_messages", filter: `conversation_id=eq.${conversationId}` }, (payload) => {
        if (payload.eventType === "INSERT") {
          const m = payload.new as MsgRow;
          setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev.map((x) => (x.id === m.id ? m : x)) : [...prev, m]));
        } else if (payload.eventType === "UPDATE") {
          const m = payload.new as MsgRow;
          setMessages((prev) => prev.map((x) => (x.id === m.id ? m : x)));
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [supabase, conversationId]);

  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [messages.length]);

  const patchConv = async (patch: Record<string, unknown>) => {
    if (!conversation) return;
    try {
      const updated = await api<ConvRow>(`/api/whatsapp/conversations/${conversationId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch),
      });
      setConversation(updated); onConversationChange();
    } catch { /* ignore */ }
  };

  if (loading) return <div className="flex-1 flex items-center justify-center text-gray-400"><Loader2 className="animate-spin" size={20} /></div>;
  if (!conversation) return null;

  const name = conversation.contact_name || conversation.contact_phone;

  // group messages by day for separators
  const groups: { date: string; items: MsgRow[] }[] = [];
  for (const m of messages) {
    const key = new Date(m.created_at).toDateString();
    const last = groups[groups.length - 1];
    if (last && last.date === key) last.items.push(m);
    else groups.push({ date: key, items: [m] });
  }

  return (
    <>
      {/* Header */}
      <div className="px-3 lg:px-5 h-16 border-b border-gray-100 flex items-center gap-3 bg-white shrink-0">
        <button onClick={onBackMobile} aria-label="Voltar" className="lg:hidden p-1.5 -ml-1 rounded-lg text-gray-500 hover:bg-gray-100"><ChevronLeft size={20} /></button>
        <Avatar name={name} />
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm text-gray-900 truncate">{name}</div>
          <div className="text-[11px] text-gray-500 flex items-center gap-2">
            <span className="truncate">{conversation.contact_phone}</span>
            {conversation.guest_id && <span className="text-brand-600 shrink-0">· hóspede</span>}
          </div>
        </div>
        <button
          onClick={() => patchConv({ ai_active: !conversation.ai_active })}
          title={conversation.ai_active ? "IA ativa — pausar" : "IA pausada — ativar"}
          aria-label={conversation.ai_active ? "Pausar IA" : "Ativar IA"}
          className={cn("inline-flex items-center gap-1.5 px-2.5 h-8 rounded-lg text-xs font-semibold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40",
            conversation.ai_active ? "bg-brand-500/10 text-brand-600" : "bg-gray-100 text-gray-500 hover:bg-gray-200")}
        >
          {conversation.ai_active ? <Bot size={15} /> : <BotOff size={15} />}<span className="hidden sm:inline">{conversation.ai_active ? "IA ativa" : "Manual"}</span>
        </button>
        <button onClick={() => patchConv({ pinned: !conversation.pinned })} title={conversation.pinned ? "Desafixar" : "Fixar"} aria-label={conversation.pinned ? "Desafixar" : "Fixar"} className="p-2 rounded-lg text-gray-400 hover:bg-gray-100 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40">
          {conversation.pinned ? <PinOff size={16} /> : <Pin size={16} />}
        </button>
        <div className="hidden lg:block w-px h-6 bg-gray-200 mx-0.5" />
        <button onClick={onToggleFocus} title={focusMode ? "Mostrar lista" : "Expandir conversa"} aria-label={focusMode ? "Mostrar lista" : "Expandir conversa"} className="hidden lg:inline-flex p-2 rounded-lg text-gray-400 hover:bg-gray-100 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40">
          {focusMode ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
        </button>
        <button onClick={onTogglePanel} title={panelOpen ? "Ocultar contato" : "Mostrar contato"} aria-label={panelOpen ? "Ocultar contato" : "Mostrar contato"} className={cn("hidden xl:inline-flex p-2 rounded-lg transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40", panelOpen ? "bg-brand-500/10 text-brand-600" : "text-gray-400 hover:bg-gray-100")}>
          {panelOpen ? <PanelRightClose size={16} /> : <PanelRightOpen size={16} />}
        </button>
      </div>

      {/* AI paused banner */}
      {!conversation.ai_active && (
        <div className="flex items-center justify-between gap-2 px-4 py-2 bg-gray-50 border-b border-gray-100 text-xs text-gray-500">
          <span className="flex items-center gap-1.5"><BotOff size={13} /> IA pausada — você responde manualmente.</span>
          <button onClick={() => patchConv({ ai_active: true })} className="inline-flex items-center gap-1 text-brand-600 font-semibold hover:underline"><Play size={11} /> Reativar</button>
        </div>
      )}

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 lg:px-6 lg:py-5 space-y-1 bg-gradient-to-b from-brand-50/40 to-white scrollbar-thin">
        {messages.length === 0 ? (
          <div className="h-full flex items-center justify-center text-sm text-gray-400">Sem mensagens ainda. Comece enviando uma mensagem abaixo.</div>
        ) : (
          groups.map((g) => (
            <div key={g.date} className="space-y-1.5">
              <div className="flex justify-center py-2 sticky top-0">
                <span className="text-[10px] font-medium uppercase tracking-wide text-gray-500 bg-white/90 backdrop-blur border border-gray-200 px-3 py-1 rounded-full shadow-sm">{dayLabel(g.items[0].created_at)}</span>
              </div>
              {g.items.map((m, i) => (
                <MessageBubble key={m.id} message={m} grouped={i > 0 && g.items[i - 1].direction === m.direction && g.items[i - 1].sender === m.sender} />
              ))}
            </div>
          ))
        )}
      </div>

      {/* Composer */}
      {err && <div className="px-3 pt-2 text-xs text-red-500 flex items-center gap-1 bg-white"><AlertCircle size={12} aria-hidden="true" /> {err}</div>}
      <ChatComposer
        conversationId={conversationId}
        purpose="booking"
        accent="brand"
        contactName={conversation.contact_name}
        contactPhone={conversation.contact_phone}
        aiActive={conversation.ai_active}
        onSent={() => { refresh(); onConversationChange(); }}
      />
    </>
  );
}

function MessageBubble({ message, grouped }: { message: MsgRow; grouped: boolean }) {
  const outbound = message.direction === "outbound";
  const isAi = outbound && message.sender === "ai";
  return (
    <div className={cn("flex flex-col", outbound ? "items-end" : "items-start", grouped ? "mt-0.5" : "mt-2")}>
      {!grouped && (
        <span className="text-[10px] text-gray-400 mb-0.5 px-1">{senderLabel(message.sender, message.direction)}</span>
      )}
      <div className={cn(
        "max-w-[80%] md:max-w-[68%] rounded-2xl px-3.5 py-2 text-sm shadow-sm",
        outbound
          ? isAi
            ? "bg-amber-50 border border-amber-200 text-amber-900 rounded-br-md"
            : "bg-brand-500 text-white rounded-br-md"
          : "bg-white border border-gray-200 text-gray-900 rounded-bl-md"
      )}>
        {isAi && <span className="flex items-center gap-1 mb-1 text-[9px] uppercase font-bold tracking-wide text-amber-600"><Bot size={11} /> Resposta IA</span>}
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
  if (direction === "inbound") return "Cliente";
  if (sender === "ai") return "IA · automática";
  if (sender === "agent") return "Você";
  if (sender === "system") return "Sistema";
  return "";
}
