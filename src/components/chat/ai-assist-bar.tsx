"use client";

import { useState } from "react";
import { Sparkles, FileText, Loader2, X, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface ApiResp<T> {
  success: boolean;
  data?: T;
  error?: string;
}
async function api<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  const json = (await res.json()) as ApiResp<T>;
  if (!json.success) throw new Error(json.error || `HTTP ${res.status}`);
  return json.data as T;
}

/**
 * Compact AI helper bar for a chat composer.
 * - "Sugerir respostas": fetches 3 reply suggestions; clicking one inserts it.
 * - "Resumir conversa": fetches a short summary shown in a dismissible panel.
 * `accent` lets each shell keep its own existing color (no new palette).
 */
export function AiAssistBar({
  conversationId,
  purpose,
  onInsert,
  accent = "brand",
}: {
  conversationId: string;
  purpose: "booking" | "sales";
  onInsert: (text: string) => void;
  accent?: "brand" | "amber";
}) {
  const [loadingSug, setLoadingSug] = useState(false);
  const [loadingSum, setLoadingSum] = useState(false);
  const [suggestions, setSuggestions] = useState<string[] | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const accentBtn =
    accent === "amber"
      ? "text-amber-700 hover:bg-amber-50 border-amber-200"
      : "text-brand-600 hover:bg-brand-50 border-brand-200";

  async function getSuggestions() {
    setLoadingSug(true);
    setErr(null);
    setSummary(null);
    try {
      const data = await api<{ suggestions: string[] }>(
        `/api/whatsapp/conversations/${conversationId}/suggest-reply`,
        { purpose }
      );
      setSuggestions(data.suggestions.length ? data.suggestions : ["(sem sugestões)"]);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Falha ao sugerir");
    } finally {
      setLoadingSug(false);
    }
  }

  async function getSummary() {
    setLoadingSum(true);
    setErr(null);
    setSuggestions(null);
    try {
      const data = await api<{ summary: string }>(
        `/api/whatsapp/conversations/${conversationId}/summarize`,
        { purpose }
      );
      setSummary(data.summary);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Falha ao resumir");
    } finally {
      setLoadingSum(false);
    }
  }

  return (
    <div className="mb-2">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={getSuggestions}
          disabled={loadingSug}
          className={cn(
            "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-semibold bg-white transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40 disabled:opacity-50",
            accentBtn
          )}
        >
          {loadingSug ? <Loader2 size={12} className="animate-spin" aria-hidden="true" /> : <Sparkles size={12} aria-hidden="true" />}
          Sugerir respostas
        </button>
        <button
          type="button"
          onClick={getSummary}
          disabled={loadingSum}
          className={cn(
            "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-semibold bg-white transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40 disabled:opacity-50",
            accentBtn
          )}
        >
          {loadingSum ? <Loader2 size={12} className="animate-spin" aria-hidden="true" /> : <FileText size={12} aria-hidden="true" />}
          Resumir conversa
        </button>
      </div>

      {err && (
        <div className="mt-2 text-[11px] text-red-500 flex items-center gap-1">
          <AlertCircle size={12} aria-hidden="true" /> {err}
        </div>
      )}

      {suggestions && (
        <div className="mt-2 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Sugestões da IA</span>
            <button
              type="button"
              onClick={() => setSuggestions(null)}
              aria-label="Fechar sugestões"
              className="text-gray-400 hover:text-gray-600 transition-colors duration-150 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40"
            >
              <X size={13} aria-hidden="true" />
            </button>
          </div>
          {suggestions.map((s, i) => (
            <button
              key={i}
              type="button"
              onClick={() => {
                onInsert(s);
                setSuggestions(null);
              }}
              className="w-full text-left text-xs text-gray-700 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg px-3 py-2 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40 cursor-pointer"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {summary && (
        <div className="mt-2 relative bg-gray-50 border border-gray-200 rounded-lg p-3 pr-7 text-xs text-gray-700 whitespace-pre-wrap">
          <button
            type="button"
            onClick={() => setSummary(null)}
            aria-label="Fechar resumo"
            className="absolute top-2 right-2 text-gray-400 hover:text-gray-600 transition-colors duration-150 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40"
          >
            <X size={13} aria-hidden="true" />
          </button>
          {summary}
        </div>
      )}
    </div>
  );
}
