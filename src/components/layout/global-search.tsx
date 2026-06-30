"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, X, CalendarDays, Users, Home, Loader2, type LucideIcon } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { cn } from "@/lib/utils/cn";

interface SearchItem {
  id: string;
  title: string;
  subtitle?: string | null;
  href: string;
}
interface Results {
  reservations: SearchItem[];
  guests: SearchItem[];
  properties: SearchItem[];
}

const EMPTY: Results = { reservations: [], guests: [], properties: [] };

const GROUPS: Array<{ key: keyof Results; label: string; icon: LucideIcon }> = [
  { key: "reservations", label: "Reservas", icon: CalendarDays },
  { key: "guests", label: "Hóspedes", icon: Users },
  { key: "properties", label: "Imóveis", icon: Home },
];

function flatten(r: Results): SearchItem[] {
  return [...r.reservations, ...r.guests, ...r.properties];
}

/** Shared search state: debounced fetch against /api/search with abort. */
function useGlobalSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Results>(EMPTY);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) {
      setResults(EMPTY);
      setLoading(false);
      abortRef.current?.abort();
      return;
    }
    setLoading(true);
    const handle = setTimeout(async () => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(term)}`, { signal: ctrl.signal });
        const json = await res.json();
        if (json?.success) setResults(json.data as Results);
      } catch {
        /* aborted or network — ignore */
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    }, 250);
    return () => clearTimeout(handle);
  }, [query]);

  const reset = useCallback(() => {
    setQuery("");
    setResults(EMPTY);
  }, []);

  return { query, setQuery, results, loading, reset };
}

function ResultsPanel({
  query,
  results,
  loading,
  onPick,
}: {
  query: string;
  results: Results;
  loading: boolean;
  onPick: (href: string) => void;
}) {
  const term = query.trim();
  const total = flatten(results).length;

  if (term.length < 2) {
    return <p className="px-3 py-6 text-center text-xs text-gray-400">Digite ao menos 2 caracteres…</p>;
  }
  if (loading && total === 0) {
    return (
      <div className="flex items-center justify-center gap-2 px-3 py-6 text-xs text-gray-400">
        <Loader2 size={14} className="animate-spin" aria-hidden="true" /> Buscando…
      </div>
    );
  }
  if (total === 0) {
    return <p className="px-3 py-6 text-center text-xs text-gray-400">Nenhum resultado para “{term}”.</p>;
  }

  return (
    <div className="py-1">
      {GROUPS.map(({ key, label, icon: Icon }) => {
        const items = results[key];
        if (items.length === 0) return null;
        return (
          <div key={key} className="px-1 py-1">
            <div className="px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
              {label}
            </div>
            {items.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onPick(item.href)}
                className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors duration-150 hover:bg-gray-50 focus-visible:bg-gray-50 focus-visible:outline-none"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-500">
                  <Icon size={14} aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-gray-800">{item.title}</span>
                  {item.subtitle && (
                    <span className="block truncate text-xs text-gray-400">{item.subtitle}</span>
                  )}
                </span>
              </button>
            ))}
          </div>
        );
      })}
    </div>
  );
}

export function GlobalSearch() {
  const router = useRouter();
  const { query, setQuery, results, loading, reset } = useGlobalSearch();
  const [openDesktop, setOpenDesktop] = useState(false);
  const [openMobile, setOpenMobile] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const pick = useCallback(
    (href: string) => {
      reset();
      setOpenDesktop(false);
      setOpenMobile(false);
      router.push(href);
    },
    [reset, router]
  );

  // Close the desktop dropdown on outside click.
  useEffect(() => {
    if (!openDesktop) return;
    function onDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpenDesktop(false);
      }
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [openDesktop]);

  const onSubmit = useCallback(() => {
    const first = flatten(results)[0];
    if (first) pick(first.href);
  }, [results, pick]);

  return (
    <>
      {/* Desktop — inline input + dropdown */}
      <div ref={containerRef} className="relative hidden md:block">
        <Search
          size={15}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-300"
          aria-hidden="true"
        />
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpenDesktop(true);
          }}
          onFocus={() => setOpenDesktop(true)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setOpenDesktop(false);
              (e.target as HTMLInputElement).blur();
            } else if (e.key === "Enter") {
              onSubmit();
            }
          }}
          placeholder="Buscar reservas, hóspedes, imóveis…"
          aria-label="Busca global"
          className="w-56 rounded-lg border border-gray-200 bg-gray-50 py-2 pl-9 pr-8 font-body text-sm transition-colors duration-200 focus:w-72 focus:border-brand-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-400/20 lg:w-64"
        />
        {query && (
          <button
            type="button"
            onClick={() => {
              reset();
              setOpenDesktop(false);
            }}
            aria-label="Limpar busca"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-gray-300 hover:text-gray-500"
          >
            <X size={14} aria-hidden="true" />
          </button>
        )}

        {openDesktop && query.trim().length >= 1 && (
          <div className="absolute left-0 top-full z-dropdown mt-2 w-[22rem] overflow-hidden rounded-xl border border-gray-200 bg-white shadow-dropdown animate-scale-in">
            <ResultsPanel query={query} results={results} loading={loading} onPick={pick} />
          </div>
        )}
      </div>

      {/* Mobile — icon opens a dialog */}
      <button
        type="button"
        onClick={() => setOpenMobile(true)}
        aria-label="Buscar"
        className="rounded-lg p-2 text-gray-400 transition-colors duration-200 hover:bg-gray-50 hover:text-gray-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40 md:hidden"
      >
        <Search size={18} aria-hidden="true" />
      </button>

      <Dialog
        open={openMobile}
        onOpenChange={(o) => {
          setOpenMobile(o);
          if (!o) reset();
        }}
      >
        <DialogContent hideClose className="sm:max-w-md p-0">
          <div className="relative border-b border-gray-100 p-3">
            <Search
              size={16}
              className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-gray-300"
              aria-hidden="true"
            />
            {/* eslint-disable-next-line jsx-a11y/no-autofocus */}
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar reservas, hóspedes, imóveis…"
              aria-label="Busca global"
              className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2.5 pl-9 pr-3 font-body text-sm focus:border-brand-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-400/20"
            />
          </div>
          <div className="max-h-[60vh] overflow-y-auto scrollbar-thin">
            <ResultsPanel query={query} results={results} loading={loading} onPick={pick} />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
