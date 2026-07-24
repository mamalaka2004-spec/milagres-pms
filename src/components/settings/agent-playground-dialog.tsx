"use client";

import { useRef, useState } from "react";
import { Loader2, Send, Sparkles, RotateCcw, User, Bot } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils/cn";
import { api } from "@/lib/chat/utils";
import { toast } from "@/components/ui/use-toast";

interface Msg {
  role: "user" | "assistant";
  content: string;
}

/**
 * Playground de teste do agente: você escreve como o lead e vê a resposta da IA
 * usando o prompt salvo. Simulação de estilo — não roda tools nem envia WhatsApp.
 */
export function AgentPlaygroundDialog({
  agentId,
  agentName,
  open,
  onOpenChange,
}: {
  agentId: string | null;
  agentName?: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [cold, setCold] = useState(true);
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  async function send() {
    const text = input.trim();
    if (!text || loading || !agentId) return;
    const next = [...messages, { role: "user" as const, content: text }];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const res = await api<{ reply: string }>(`/api/ai/agents/${agentId}/playground`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next, cold }),
      });
      setMessages((m) => [...m, { role: "assistant", content: res.reply }]);
      setTimeout(() => scrollRef.current?.scrollTo({ top: 999999, behavior: "smooth" }), 50);
    } catch (e) {
      toast({ title: "Erro no playground", description: e instanceof Error ? e.message : "", variant: "error" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[96vw] sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            <Sparkles size={16} className="text-brand-600" /> Playground — {agentName || "Agente"}
            <label className="ml-auto flex items-center gap-1.5 text-xs font-normal text-gray-500">
              <input type="checkbox" checked={cold} onChange={(e) => setCold(e.target.checked)} className="accent-brand-500" />
              simular prospecção fria
            </label>
            <button
              onClick={() => setMessages([])}
              className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2 py-1 text-xs font-normal text-gray-600 hover:bg-gray-50"
              title="Limpar conversa"
            >
              <RotateCcw size={12} /> limpar
            </button>
          </DialogTitle>
        </DialogHeader>
        <DialogBody className="space-y-3">
          <div ref={scrollRef} className="h-[52vh] space-y-2 overflow-y-auto rounded-xl border border-gray-200 bg-gray-50/40 p-3 scrollbar-thin">
            {messages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center text-xs text-gray-400">
                <Bot size={22} />
                Escreva como se fosse o lead (ex.: &quot;quem é você?&quot;, &quot;me fala mais&quot;, &quot;quanto custa?&quot;)
                e veja como a {agentName || "IA"} responderia. Ela consulta o catálogo de imóveis de verdade
                (por orçamento) — mas nada é enviado por WhatsApp nem gera lead.
              </div>
            ) : (
              messages.map((m, i) => (
                <div key={i} className={cn("flex gap-2", m.role === "user" ? "justify-end" : "justify-start")}>
                  {m.role === "assistant" && <Bot size={16} className="mt-1 shrink-0 text-brand-500" />}
                  <div
                    className={cn(
                      "max-w-[80%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm",
                      m.role === "user" ? "bg-brand-500 text-white" : "bg-white text-gray-800 shadow-sm"
                    )}
                  >
                    {m.content}
                  </div>
                  {m.role === "user" && <User size={16} className="mt-1 shrink-0 text-gray-400" />}
                </div>
              ))
            )}
            {loading && (
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <Bot size={16} className="text-brand-500" /> <Loader2 size={13} className="animate-spin" /> digitando…
              </div>
            )}
          </div>

          <div className="flex items-end gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              rows={2}
              placeholder="Escreva como o lead… (Enter envia, Shift+Enter quebra linha)"
              className="flex-1 resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40"
            />
            <button
              onClick={send}
              disabled={loading || !input.trim()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50"
            >
              {loading ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
            </button>
          </div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
