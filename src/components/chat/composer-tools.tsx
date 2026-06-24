"use client";

import { useEffect, useRef, useState } from "react";
import { Zap, Braces, Smile, Loader2, Search } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { EmojiPicker } from "@/components/chat/emoji-picker";

interface QuickReply {
  id: string;
  title: string;
  body: string;
  shortcut: string | null;
  category: string | null;
}

interface ApiResp<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/** Resolve {{nome}}/{{empresa}}/{{telefone}} tokens against the given values. */
function resolve(text: string, vars: Record<string, string | null | undefined>): string {
  return text.replace(/\{\{\s*(\w+)\s*\}\}/g, (m, key: string) => {
    const v = vars[key];
    return v ? v : m;
  });
}

/**
 * Composer toolbar: quick replies, variable insertion and emoji.
 * `accent` keeps each shell's existing color (brand vs amber) — no new palette.
 */
export function ComposerTools({
  onInsert,
  variables,
  accent = "brand",
}: {
  onInsert: (text: string) => void;
  variables: Record<string, string | null | undefined>;
  accent?: "brand" | "amber";
}) {
  const [open, setOpen] = useState<null | "quick" | "vars" | "emoji">(null);
  const [replies, setReplies] = useState<QuickReply[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const wrapRef = useRef<HTMLDivElement>(null);

  const accentText = accent === "amber" ? "text-amber-600" : "text-brand-600";

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(null);
    }
    if (open) document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  async function openQuick() {
    setOpen(open === "quick" ? null : "quick");
    if (replies === null) {
      setLoading(true);
      try {
        const res = await fetch("/api/whatsapp/quick-replies");
        const json = (await res.json()) as ApiResp<QuickReply[]>;
        setReplies(json.success && json.data ? json.data : []);
      } catch {
        setReplies([]);
      } finally {
        setLoading(false);
      }
    }
  }

  const varList = [
    { key: "nome", label: "Nome do contato" },
    { key: "empresa", label: "Empresa" },
    { key: "telefone", label: "Telefone" },
  ];

  const filteredReplies = (replies || []).filter(
    (r) =>
      !q.trim() ||
      r.title.toLowerCase().includes(q.toLowerCase()) ||
      r.body.toLowerCase().includes(q.toLowerCase())
  );

  const btn = "p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40";

  return (
    <div ref={wrapRef} className="relative flex items-center gap-0.5">
      <button type="button" onClick={openQuick} aria-label="Respostas rápidas" className={cn(btn, open === "quick" && accentText)}>
        <Zap size={18} aria-hidden="true" />
      </button>
      <button type="button" onClick={() => setOpen(open === "vars" ? null : "vars")} aria-label="Variáveis" className={cn(btn, open === "vars" && accentText)}>
        <Braces size={18} aria-hidden="true" />
      </button>
      <button type="button" onClick={() => setOpen(open === "emoji" ? null : "emoji")} aria-label="Emoji" className={cn(btn, open === "emoji" && accentText)}>
        <Smile size={18} aria-hidden="true" />
      </button>

      {/* Quick replies popover */}
      {open === "quick" && (
        <div className="absolute bottom-full left-0 mb-2 w-72 bg-white border border-gray-200 rounded-xl shadow-lg z-30 overflow-hidden">
          <div className="p-2 border-b border-gray-100">
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden="true" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                aria-label="Buscar resposta rápida"
                placeholder="Buscar resposta…"
                className="w-full pl-8 pr-2 py-1.5 text-xs rounded-lg border border-gray-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40"
              />
            </div>
          </div>
          <div className="max-h-64 overflow-y-auto scrollbar-thin p-1">
            {loading ? (
              <div className="p-4 flex justify-center text-gray-400"><Loader2 size={16} className="animate-spin" aria-hidden="true" /></div>
            ) : filteredReplies.length === 0 ? (
              <div className="p-4 text-center text-[11px] text-gray-400">
                {replies && replies.length === 0
                  ? "Nenhuma resposta rápida. Rode a migration 008 e cadastre algumas."
                  : "Nada encontrado."}
              </div>
            ) : (
              filteredReplies.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => { onInsert(resolve(r.body, variables)); setOpen(null); setQ(""); }}
                  className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-gray-50 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40 cursor-pointer"
                >
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold text-gray-800 truncate">{r.title}</span>
                    {r.category && <span className="text-[9px] uppercase tracking-wide text-gray-400">{r.category}</span>}
                  </div>
                  <p className="text-[11px] text-gray-500 truncate mt-0.5">{resolve(r.body, variables)}</p>
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {/* Variables popover */}
      {open === "vars" && (
        <div className="absolute bottom-full left-0 mb-2 w-56 bg-white border border-gray-200 rounded-xl shadow-lg z-30 p-1">
          <div className="px-2 py-1 flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Inserir variável</span>
          </div>
          {varList.map((v) => {
            const val = variables[v.key];
            return (
              <button
                key={v.key}
                type="button"
                onClick={() => { onInsert(val || `{{${v.key}}}`); setOpen(null); }}
                className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-gray-50 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40 cursor-pointer flex items-center justify-between gap-2"
              >
                <span className="text-xs text-gray-700">{v.label}</span>
                <span className="text-[10px] text-gray-400 truncate max-w-[90px]">{val || `{{${v.key}}}`}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Emoji popover */}
      {open === "emoji" && (
        <div className="absolute bottom-full left-0 mb-2 bg-white border border-gray-200 rounded-xl shadow-lg z-30 p-2">
          <EmojiPicker onSelect={(e) => onInsert(e)} />
        </div>
      )}
    </div>
  );
}
