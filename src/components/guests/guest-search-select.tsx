"use client";

import { useEffect, useRef, useState } from "react";
import { Search, Plus, Star, X } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export interface GuestOption {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  is_vip: boolean;
}

interface GuestSearchSelectProps {
  value?: GuestOption | null;
  onChange: (guest: GuestOption | null) => void;
  onCreateNew?: () => void;
  placeholder?: string;
}

export function GuestSearchSelect({
  value,
  onChange,
  onCreateNew,
  placeholder = "Search guest by name, email or phone...",
}: GuestSearchSelectProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<GuestOption[]>([]);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!query || query.length < 2) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/guests?search=${encodeURIComponent(query)}`);
        const json = await res.json();
        if (json.success) setResults(json.data);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    function onClickAway(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickAway);
    return () => document.removeEventListener("mousedown", onClickAway);
  }, []);

  if (value) {
    return (
      <div className="flex items-center justify-between px-4 py-3 rounded-lg border border-brand-300 bg-brand-50/30">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm text-gray-900 truncate">
              {value.full_name}
            </span>
            {value.is_vip && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">
                <Star size={10} fill="currentColor" /> VIP
              </span>
            )}
          </div>
          <div className="text-xs text-gray-500 truncate">
            {value.email || value.phone || "—"}
          </div>
        </div>
        <button
          type="button"
          onClick={() => onChange(null)}
          className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
        >
          <X size={16} />
        </button>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-400/15"
        />
      </div>

      {open && (query.length >= 2 || onCreateNew) && (
        <div className="absolute z-30 mt-1 w-full bg-white rounded-lg border border-gray-200 shadow-lg max-h-72 overflow-y-auto">
          {loading && (
            <div className="px-4 py-3 text-sm text-gray-400">Searching...</div>
          )}
          {!loading && query.length >= 2 && results.length === 0 && (
            <div className="px-4 py-3 text-sm text-gray-400">No guests found.</div>
          )}
          {results.map((g) => (
            <button
              type="button"
              key={g.id}
              onClick={() => {
                onChange(g);
                setQuery("");
                setOpen(false);
              }}
              className={cn(
                "w-full px-4 py-2.5 text-left hover:bg-gray-50 border-b border-gray-100 last:border-0 flex items-start gap-2"
              )}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm text-gray-900 truncate">
                    {g.full_name}
                  </span>
                  {g.is_vip && (
                    <Star size={11} className="text-amber-500" fill="currentColor" />
                  )}
                </div>
                <div className="text-xs text-gray-500 truncate">
                  {[g.email, g.phone].filter(Boolean).join(" · ") || "—"}
                </div>
              </div>
            </button>
          ))}
          {onCreateNew && (
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onCreateNew();
              }}
              className="w-full px-4 py-2.5 text-left text-sm text-brand-600 hover:bg-brand-50 font-semibold flex items-center gap-2 border-t border-gray-100"
            >
              <Plus size={14} /> Create new guest
            </button>
          )}
        </div>
      )}
    </div>
  );
}
