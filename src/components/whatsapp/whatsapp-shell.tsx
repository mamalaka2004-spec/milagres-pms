"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  MessageSquare,
  Send,
  Loader2,
  Search,
  Pin,
  PinOff,
  Bot,
  Phone,
  CheckCheck,
  AlertCircle,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils/cn";
import type {
  Database,
  WaConversationStatus,
  WaMessageDirection,
  WaMessageSender,
  WaMessageStatus,
} from "@/types/database";

type LineRow = Database["public"]["Tables"]["whatsapp_lines"]["Row"];
type ConvRow = Database["public"]["Tables"]["whatsapp_conversations"]["Row"];
type MsgRow = Database["public"]["Tables"]["whatsapp_messages"]["Row"];

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
  const yesterday = new Date(today.getTime() - 86_400_000);
  if (d.toDateString() === yesterday.toDateString()) return "Ontem";
  if (today.getTime() - d.getTime() < 7 * 86_400_000) {
    return d.toLocaleDateString("pt-BR", { weekday: "short" });
  }
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

function formatTimeFull(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export function WhatsappShell() {
  const [lines, setLines] = useState<LineRow[]>([]);
  const [activeLineId, setActiveLineId] = useState<string | null>(null);
  const [loadingLines, setLoadingLines] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // initial load
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await api<LineRow[]>("/api/whatsapp/lines");
        if (cancelled) return;
        setLines(data);
        if (data.length > 0) setActiveLineId(data[0].id);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load lines");
      } finally {
        if (!cancelled) setLoadingLines(false);
      }
    })();
    return () => {
      cancelled = true;
    };
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
        <AlertCircle size={16} /> {error}
      </div>
    );
  }

  if (lines.length === 0) {
    return (
      <div className="h-[calc(100vh-180px)] flex items-center justify-center">
        <EmptyLines />
      </div>
    );
  }

  const activeLine = lines.find((l) => l.id === activeLineId) || lines[0];

  return (
    <div className="h-[calc(100vh-180px)] min-h-[520px] flex flex-col">
      {lines.length > 1 && (
        <LinePicker lines={lines} activeId={activeLine.id} onSelect={setActiveLineId} />
      )}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-3 overflow-hidden">
        <ConversationListPane lineId={activeLine.id} />
      </div>
    </div>
  );
}

function EmptyLines() {
  return (
    <div className="text-center max-w-sm">
      <div className="w-12 h-12 rounded-full bg-brand-500/10 mx-auto flex items-center justify-center mb-3">
        <MessageSquare className="text-brand-600" size={20} />
      </div>
      <h3 className="font-semibold text-gray-900 mb-1">Nenhuma linha conectada</h3>
      <p className="text-sm text-gray-500">
        Peça para um administrador conectar um número WhatsApp em Settings → WhatsApp Lines (em
        breve). Por enquanto, linhas podem ser criadas via API: <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">POST /api/whatsapp/lines</code>.
      </p>
    </div>
  );
}

function LinePicker({
  lines,
  activeId,
  onSelect,
}: {
  lines: LineRow[];
  activeId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="flex gap-1 p-1 bg-gray-50 rounded-lg mb-3 self-start">
      {lines.map((l) => (
        <button
          key={l.id}
          onClick={() => onSelect(l.id)}
          className={cn(
            "px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5",
            activeId === l.id
              ? "bg-white shadow-sm text-brand-600"
              : "text-gray-500 hover:text-gray-700"
          )}
        >
          <Phone size={11} />
          {l.label}
          <span className="text-[10px] text-gray-400 font-normal">{l.phone}</span>
        </button>
      ))}
    </div>
  );
}

/* ─────────────────────── Conversation list + thread ─────────────────────── */

function ConversationListPane({ lineId }: { lineId: string }) {
  const [conversations, setConversations] = useState<ConvRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "unread" | "open" | "closed">("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const supabase = useMemo(() => createClient(), []);

  const loadConversations = useCallback(async () => {
    try {
      const params = new URLSearchParams({ line_id: lineId });
      if (filter === "unread") params.set("unread", "1");
      if (filter === "open") params.set("status", "open");
      if (filter === "closed") params.set("status", "closed");
      if (search.trim()) params.set("q", search.trim());
      const data = await api<ConvRow[]>(`/api/whatsapp/conversations?${params}`);
      setConversations(data);
      if (!selectedId && data.length > 0) setSelectedId(data[0].id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [lineId, filter, search, selectedId]);

  useEffect(() => {
    setLoading(true);
    setSelectedId(null);
    loadConversations();
  }, [lineId, filter]); // eslint-disable-line react-hooks/exhaustive-deps

  // search debounce
  useEffect(() => {
    const t = setTimeout(loadConversations, 250);
    return () => clearTimeout(t);
  }, [search]); // eslint-disable-line react-hooks/exhaustive-deps

  // realtime — bump conversation when a new message lands
  useEffect(() => {
    const channel = supabase
      .channel(`wa-conv-${lineId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "whatsapp_conversations", filter: `line_id=eq.${lineId}` },
        () => loadConversations()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, lineId, loadConversations]);

  return (
    <>
      <aside className="bg-white border border-gray-200 rounded-xl flex flex-col overflow-hidden min-h-0">
        <div className="p-3 border-b border-gray-100 space-y-2">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome ou número"
              className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-gray-200 focus:outline-none focus:border-brand-500"
            />
          </div>
          <div className="flex gap-1">
            {(
              [
                ["all", "Todas"],
                ["unread", "Não lidas"],
                ["open", "Abertas"],
                ["closed", "Fechadas"],
              ] as const
            ).map(([id, lbl]) => (
              <button
                key={id}
                onClick={() => setFilter(id)}
                className={cn(
                  "px-2.5 py-1 text-[11px] rounded-md font-medium transition",
                  filter === id ? "bg-brand-500/10 text-brand-600" : "text-gray-500 hover:bg-gray-100"
                )}
              >
                {lbl}
              </button>
            ))}
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
            <div className="p-6 text-center text-sm text-gray-400">Nenhuma conversa</div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {conversations.map((c) => (
                <li key={c.id}>
                  <button
                    onClick={() => setSelectedId(c.id)}
                    className={cn(
                      "w-full text-left px-3 py-3 flex gap-3 hover:bg-gray-50 transition",
                      selectedId === c.id && "bg-brand-500/5"
                    )}
                  >
                    <Avatar name={c.contact_name || c.contact_phone} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="font-medium text-sm text-gray-900 truncate">
                          {c.contact_name || c.contact_phone}
                        </span>
                        <span className="text-[10px] text-gray-400 shrink-0">
                          {formatTime(c.last_message_at)}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-xs text-gray-500 truncate flex-1">
                          {c.last_message_text || "—"}
                        </span>
                        {c.pinned && <Pin size={10} className="text-brand-500 shrink-0" />}
                        {c.unread_count > 0 && (
                          <span className="bg-brand-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center shrink-0">
                            {c.unread_count}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>
      <section className="bg-white border border-gray-200 rounded-xl flex flex-col overflow-hidden min-h-0">
        {selectedId ? (
          <ConversationView
            conversationId={selectedId}
            onConversationChange={loadConversations}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
            Selecione uma conversa
          </div>
        )}
      </section>
    </>
  );
}

function Avatar({ name }: { name: string }) {
  const initials = (name || "?")
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
  return (
    <div className="w-9 h-9 rounded-full bg-brand-500/15 text-brand-700 flex items-center justify-center text-xs font-semibold shrink-0">
      {initials.slice(0, 2)}
    </div>
  );
}

/* ─────────────────────── Single conversation thread ─────────────────────── */

function ConversationView({
  conversationId,
  onConversationChange,
}: {
  conversationId: string;
  onConversationChange: () => void;
}) {
  const [conversation, setConversation] = useState<ConvRow | null>(null);
  const [messages, setMessages] = useState<MsgRow[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
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
      setErr(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [conversationId]);

  useEffect(() => {
    setLoading(true);
    setMessages([]);
    setConversation(null);
    setErr(null);
    refresh();
  }, [conversationId, refresh]);

  // mark as read on open
  useEffect(() => {
    if (!conversationId) return;
    fetch(`/api/whatsapp/conversations/${conversationId}/read`, { method: "POST" })
      .then(onConversationChange)
      .catch(() => null);
  }, [conversationId, onConversationChange]);

  // realtime — append new messages as they arrive
  useEffect(() => {
    const channel = supabase
      .channel(`wa-msg-${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "whatsapp_messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const newMsg = payload.new as MsgRow;
          setMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, conversationId]);

  // auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length]);

  const send = async () => {
    if (!text.trim() || sending) return;
    setSending(true);
    setErr(null);
    try {
      await api<MsgRow>(`/api/whatsapp/conversations/${conversationId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: text.trim() }),
      });
      setText("");
      onConversationChange();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Falha ao enviar");
    } finally {
      setSending(false);
    }
  };

  const togglePin = async () => {
    if (!conversation) return;
    try {
      const updated = await api<ConvRow>(`/api/whatsapp/conversations/${conversationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pinned: !conversation.pinned }),
      });
      setConversation(updated);
      onConversationChange();
    } catch {
      // ignore
    }
  };

  const toggleAi = async () => {
    if (!conversation) return;
    try {
      const updated = await api<ConvRow>(`/api/whatsapp/conversations/${conversationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ai_active: !conversation.ai_active }),
      });
      setConversation(updated);
    } catch {
      // ignore
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400">
        <Loader2 className="animate-spin" size={20} />
      </div>
    );
  }
  if (!conversation) return null;

  return (
    <>
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-3">
        <Avatar name={conversation.contact_name || conversation.contact_phone} />
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm text-gray-900 truncate">
            {conversation.contact_name || conversation.contact_phone}
          </div>
          <div className="text-[11px] text-gray-500 flex items-center gap-2">
            <span>{conversation.contact_phone}</span>
            {conversation.guest_id && (
              <span className="text-brand-600">· hóspede vinculado</span>
            )}
          </div>
        </div>
        <button
          onClick={toggleAi}
          title={conversation.ai_active ? "IA ativa (clique para pausar)" : "IA pausada"}
          className={cn(
            "p-2 rounded-lg transition",
            conversation.ai_active ? "bg-brand-500/10 text-brand-600" : "text-gray-400 hover:bg-gray-50"
          )}
        >
          <Bot size={16} />
        </button>
        <button
          onClick={togglePin}
          title={conversation.pinned ? "Desafixar" : "Fixar"}
          className="p-2 rounded-lg text-gray-400 hover:bg-gray-50"
        >
          {conversation.pinned ? <PinOff size={16} /> : <Pin size={16} />}
        </button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-2 bg-[#FAF9F5]">
        {messages.length === 0 ? (
          <div className="h-full flex items-center justify-center text-sm text-gray-400">
            Sem mensagens ainda. Comece enviando uma mensagem abaixo.
          </div>
        ) : (
          messages.map((m, i) => (
            <MessageBubble
              key={m.id}
              message={m}
              showSenderHint={
                i === 0 ||
                messages[i - 1].direction !== m.direction ||
                messages[i - 1].sender !== m.sender
              }
            />
          ))
        )}
      </div>

      {/* Composer */}
      <div className="p-3 border-t border-gray-100 bg-white">
        {err && (
          <div className="text-xs text-red-500 mb-2 flex items-center gap-1">
            <AlertCircle size={12} /> {err}
          </div>
        )}
        <div className="flex gap-2 items-end">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder="Digite uma mensagem (Enter envia, Shift+Enter quebra linha)"
            rows={1}
            className="flex-1 resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-brand-500 max-h-32"
          />
          <button
            onClick={send}
            disabled={!text.trim() || sending}
            className="bg-brand-500 hover:bg-brand-600 disabled:bg-gray-200 disabled:text-gray-400 text-white p-2.5 rounded-lg transition"
          >
            {sending ? <Loader2 className="animate-spin" size={16} /> : <Send size={16} />}
          </button>
        </div>
      </div>
    </>
  );
}

function MessageBubble({ message, showSenderHint }: { message: MsgRow; showSenderHint: boolean }) {
  const outbound = message.direction === "outbound";
  const senderTag = senderLabel(message.sender, message.direction);
  return (
    <div className={cn("flex flex-col", outbound ? "items-end" : "items-start")}>
      {showSenderHint && (
        <span className="text-[10px] text-gray-400 mb-0.5 px-1">{senderTag}</span>
      )}
      <div
        className={cn(
          "max-w-[70%] rounded-2xl px-3 py-2 text-sm shadow-sm",
          outbound
            ? message.sender === "ai"
              ? "bg-amber-50 border border-amber-100 text-amber-900 rounded-br-sm"
              : "bg-brand-500 text-white rounded-br-sm"
            : "bg-white border border-gray-100 text-gray-900 rounded-bl-sm"
        )}
      >
        {message.media_url && message.message_type === "image" && (
          <img
            src={message.media_url}
            alt={message.file_name || "image"}
            className="rounded-lg mb-1 max-h-64 object-cover"
          />
        )}
        {message.text && <p className="whitespace-pre-wrap break-words">{message.text}</p>}
        <div
          className={cn(
            "flex items-center gap-1 justify-end mt-0.5 text-[10px]",
            outbound ? (message.sender === "ai" ? "text-amber-600" : "text-white/80") : "text-gray-400"
          )}
        >
          <span>{formatTimeFull(message.created_at)}</span>
          {outbound && <StatusIcon status={message.status} />}
        </div>
      </div>
    </div>
  );
}

function senderLabel(sender: WaMessageSender, direction: WaMessageDirection): string {
  if (direction === "inbound") return "Cliente";
  if (sender === "ai") return "IA · resposta automática";
  if (sender === "agent") return "Você";
  if (sender === "system") return "Sistema";
  return "";
}

function StatusIcon({ status }: { status: WaMessageStatus }) {
  if (status === "pending") return <Loader2 size={11} className="animate-spin" />;
  if (status === "failed") return <AlertCircle size={11} />;
  if (status === "sent") return <CheckCheck size={11} />;
  if (status === "delivered") return <CheckCheck size={11} />;
  if (status === "read") return <CheckCheck size={11} className="text-blue-300" />;
  return null;
}
