"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Search, Loader2, Check, X, UserPlus } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { api } from "@/lib/chat/utils";
import { CONTACT_CATEGORY_LABELS, type ContactLite } from "@/types/campaign";

const CATEGORIES = Object.keys(CONTACT_CATEGORY_LABELS);

/** Seletor multi de contatos do fonebook (cross-base). `value` = contatos escolhidos. */
export function ContactPicker({
  value,
  onChange,
  listHeight = "h-64",
}: {
  value: ContactLite[];
  onChange: (contacts: ContactLite[]) => void;
  listHeight?: string;
}) {
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [results, setResults] = useState<ContactLite[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "100" });
      if (q.trim()) params.set("q", q.trim());
      if (category) params.set("category", category);
      setResults(await api<ContactLite[]>(`/api/contacts?${params}`));
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [q, category]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  const selectedIds = useMemo(() => new Set(value.map((v) => v.id)), [value]);

  function toggle(c: ContactLite) {
    onChange(selectedIds.has(c.id) ? value.filter((v) => v.id !== c.id) : [...value, c]);
  }
  function addAll() {
    const byId = new Map(value.map((v) => [v.id, v]));
    for (const c of results) byId.set(c.id, c);
    onChange([...byId.values()]);
  }

  return (
    <div className="space-y-2">
      {/* filtros */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por nome ou telefone…"
            className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2 pl-9 pr-3 text-sm focus:border-brand-500 focus:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40"
          />
        </div>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="rounded-lg border border-gray-200 bg-white px-2.5 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40"
        >
          <option value="">Todas categorias</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {CONTACT_CATEGORY_LABELS[c]}
            </option>
          ))}
        </select>
      </div>

      {/* selecionados */}
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>
          <b className="text-gray-800">{value.length}</b> selecionado(s)
          {value.length > 0 && (
            <button onClick={() => onChange([])} className="ml-2 text-red-500 hover:underline">
              limpar
            </button>
          )}
        </span>
        {results.length > 0 && (
          <button onClick={addAll} className="inline-flex items-center gap-1 font-medium text-brand-600 hover:underline">
            <UserPlus size={12} /> Selecionar os {results.length} resultados
          </button>
        )}
      </div>

      {/* resultados */}
      <div className={cn("overflow-y-auto scrollbar-thin rounded-xl border border-gray-200", listHeight)}>
        {loading ? (
          <div className="flex h-full items-center justify-center text-gray-400">
            <Loader2 className="animate-spin" size={18} />
          </div>
        ) : results.length === 0 ? (
          <div className="flex h-full items-center justify-center px-4 text-center text-xs text-gray-400">
            Nenhum contato encontrado.
          </div>
        ) : (
          <ul className="divide-y divide-gray-50">
            {results.map((c) => {
              const sel = selectedIds.has(c.id);
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => toggle(c)}
                    className={cn("flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-gray-50", sel && "bg-brand-50/60")}
                  >
                    <span
                      className={cn(
                        "flex h-5 w-5 shrink-0 items-center justify-center rounded border",
                        sel ? "border-brand-500 bg-brand-500 text-white" : "border-gray-300"
                      )}
                    >
                      {sel && <Check size={13} />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-gray-900">
                        {c.display_name || c.phone_e164 || c.phone_canonical}
                      </div>
                      <div className="truncate text-[11px] text-gray-400">
                        {c.phone_e164 || c.phone_canonical}
                        {c.category && ` · ${CONTACT_CATEGORY_LABELS[c.category] ?? c.category}`}
                      </div>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {value.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {value.slice(0, 30).map((c) => (
            <span key={c.id} className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-700">
              {c.display_name || c.phone_e164}
              <X size={11} className="cursor-pointer opacity-50 hover:opacity-100" onClick={() => toggle(c)} />
            </span>
          ))}
          {value.length > 30 && <span className="px-1 text-[11px] text-gray-400">+{value.length - 30}</span>}
        </div>
      )}
    </div>
  );
}
