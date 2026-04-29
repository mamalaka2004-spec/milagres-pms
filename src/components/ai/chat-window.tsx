"use client";

import { useEffect, useRef, useState } from "react";
import {
  Sparkles,
  Send,
  Loader2,
  RefreshCw,
  User as UserIcon,
  Bot,
  Briefcase,
  BarChart3,
  Heart,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";

type Mode = "guest" | "operations" | "management";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

const MODES: Array<{ id: Mode; label: string; tagline: string; icon: React.ElementType }> = [
  {
    id: "operations",
    label: "Operations",
    tagline: "Resumo do dia, reservas, calendário, tarefas",
    icon: Briefcase,
  },
  {
    id: "management",
    label: "Management",
    tagline: "KPIs, financeiro, performance",
    icon: BarChart3,
  },
  {
    id: "guest",
    label: "Guest concierge",
    tagline: "Modo cliente — disponibilidade, dicas",
    icon: Heart,
  },
];

const STARTER_PROMPTS: Record<Mode, string[]> = {
  operations: [
    "O que tem de check-in e check-out hoje?",
    "Quais reservas estão pendentes de pagamento?",
    "Tem alguma tarefa atrasada?",
  ],
  management: [
    "Como está a receita do mês?",
    "Qual canal está performando melhor neste trimestre?",
    "Mostre a ocupação por propriedade nos últimos 3 meses",
  ],
  guest: [
    "Quais propriedades vocês têm disponíveis?",
    "A Casa Coral está livre de 10 a 15 de novembro?",
    "Qual a política de cancelamento?",
  ],
};

export function ChatWindow() {
  const [mode, setMode] = useState<Mode>("operations");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const scrollerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollerRef.current) {
      scrollerRef.current.scrollTop = scrollerRef.current.scrollHeight;
    }
  }, [messages, sending]);

  const reset = () => {
    setMessages([]);
    setConversationId(null);
    setError("");
  };

  const send = async (text: string) => {
    if (!text.trim() || sending) return;
    setSending(true);
    setError("");
    const userMsg: ChatMessage = {
      id: `local-${Date.now()}`,
      role: "user",
      content: text,
    };
    setMessages((m) => [...m, userMsg]);
    setInput("");

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          mode,
          conversation_id: conversationId || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Erro ao processar pergunta");
      setConversationId(json.data.conversation_id);
      const assistantMsg: ChatMessage = {
        id: `local-${Date.now()}-a`,
        role: "assistant",
        content: json.data.message || "(sem resposta)",
      };
      setMessages((m) => [...m, assistantMsg]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro");
    } finally {
      setSending(false);
    }
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    send(input);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-4 h-[calc(100vh-180px)] min-h-[500px]">
      {/* Mode picker */}
      <aside className="bg-white rounded-xl border border-gray-200 p-3 lg:p-4 flex flex-col gap-2 overflow-y-auto">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 px-1 pb-2 border-b border-gray-100">
          Modes
        </div>
        {MODES.map((m) => {
          const Icon = m.icon;
          const active = m.id === mode;
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => {
                if (m.id === mode) return;
                setMode(m.id);
                reset();
              }}
              className={cn(
                "text-left px-3 py-2.5 rounded-lg border transition flex items-start gap-2",
                active
                  ? "border-brand-400 bg-brand-50 text-brand-700"
                  : "border-transparent hover:bg-gray-50 text-gray-700"
              )}
            >
              <Icon size={15} className={active ? "text-brand-600 mt-0.5" : "text-gray-400 mt-0.5"} />
              <div className="min-w-0">
                <div className="text-sm font-semibold">{m.label}</div>
                <div className="text-[11px] text-gray-500 leading-snug">{m.tagline}</div>
              </div>
            </button>
          );
        })}

        <button
          type="button"
          onClick={reset}
          className="mt-auto text-xs text-gray-500 hover:text-brand-600 inline-flex items-center gap-1.5 px-2 py-1.5"
        >
          <RefreshCw size={12} /> Nova conversa
        </button>
      </aside>

      {/* Chat thread */}
      <main className="bg-white rounded-xl border border-gray-200 flex flex-col overflow-hidden">
        <div ref={scrollerRef} className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-4">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center text-gray-500 max-w-md mx-auto">
              <div className="w-12 h-12 rounded-full bg-brand-50 flex items-center justify-center mb-3">
                <Sparkles size={20} className="text-brand-500" />
              </div>
              <h2 className="font-heading text-xl text-gray-900 mb-1">
                Como posso ajudar?
              </h2>
              <p className="text-sm mb-6">
                Pergunte sobre reservas, propriedades, ocupação ou qualquer coisa do dia-a-dia.
              </p>
              <div className="grid grid-cols-1 gap-2 w-full">
                {STARTER_PROMPTS[mode].map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => send(p)}
                    className="text-left px-4 py-2.5 rounded-lg border border-gray-200 hover:border-brand-300 hover:bg-brand-50/40 text-sm text-gray-700 transition"
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((m) => <MessageBubble key={m.id} message={m} />)
          )}
          {sending && <ThinkingBubble />}
        </div>

        {error && (
          <div className="px-4 py-2 text-xs text-red-700 bg-red-50 border-t border-red-200">
            {error}
          </div>
        )}

        <form onSubmit={onSubmit} className="border-t border-gray-100 p-3 flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
            placeholder="Pergunte alguma coisa..."
            rows={1}
            disabled={sending}
            className="flex-1 resize-none px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-400/15 text-sm max-h-32"
          />
          <button
            type="submit"
            disabled={sending || !input.trim()}
            className="w-10 h-10 rounded-full bg-brand-500 hover:bg-brand-600 text-white flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
          >
            {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          </button>
        </form>
      </main>
    </div>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  return (
    <div className={cn("flex gap-3", isUser ? "justify-end" : "justify-start")}>
      {!isUser && (
        <div className="w-8 h-8 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center shrink-0">
          <Bot size={15} />
        </div>
      )}
      <div
        className={cn(
          "rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap max-w-[85%] md:max-w-[75%]",
          isUser
            ? "bg-brand-500 text-white rounded-br-sm"
            : "bg-gray-100 text-gray-800 rounded-bl-sm"
        )}
      >
        {message.content}
      </div>
      {isUser && (
        <div className="w-8 h-8 rounded-full bg-gray-200 text-gray-600 flex items-center justify-center shrink-0">
          <UserIcon size={15} />
        </div>
      )}
    </div>
  );
}

function ThinkingBubble() {
  return (
    <div className="flex gap-3 justify-start">
      <div className="w-8 h-8 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center shrink-0">
        <Bot size={15} />
      </div>
      <div className="rounded-2xl rounded-bl-sm px-4 py-2.5 bg-gray-100">
        <div className="flex gap-1">
          <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: "0ms" }} />
          <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: "150ms" }} />
          <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: "300ms" }} />
        </div>
      </div>
    </div>
  );
}
