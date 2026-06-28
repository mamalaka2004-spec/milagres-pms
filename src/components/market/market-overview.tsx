"use client";

import { useState } from "react";
import { Search, MapPin, ChevronRight, Home as HomeIcon } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import MarketPanel from "@/components/properties/market-panel";

export interface MarketProperty {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
  latitude: number | null;
  longitude: number | null;
  bedrooms: number | null;
  base_price_cents: number;
  status: string | null;
}

const BRL = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

export default function MarketOverview({
  properties,
  canRun,
}: {
  properties: MarketProperty[];
  canRun: boolean;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(properties[0]?.id ?? null);
  const [query, setQuery] = useState("");

  const filtered = properties.filter((p) =>
    `${p.name} ${p.city ?? ""}`.toLowerCase().includes(query.toLowerCase())
  );
  const selected = properties.find((p) => p.id === selectedId) || null;

  if (properties.length === 0) {
    return (
      <div className="text-sm text-gray-500 bg-gray-50 border border-gray-200 rounded-xl p-6 text-center">
        Nenhum imóvel cadastrado ainda.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-4 lg:gap-6">
      {/* Property list */}
      <aside className="space-y-2">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar imóvel…"
            className="w-full h-9 pl-9 pr-3 rounded-lg border border-gray-200 bg-white text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40"
          />
        </div>
        <div className="space-y-1.5 max-h-[70vh] overflow-y-auto pr-1">
          {filtered.map((p) => {
            const active = p.id === selectedId;
            return (
              <button
                key={p.id}
                onClick={() => setSelectedId(p.id)}
                className={cn(
                  "w-full text-left rounded-xl border p-3 transition-colors duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40 group",
                  active ? "border-brand-300 bg-brand-500/[0.06]" : "border-gray-200 bg-white hover:border-brand-200 hover:bg-gray-50"
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-gray-900 truncate">{p.name}</div>
                    <div className="text-[11px] text-gray-400 flex items-center gap-1 mt-0.5">
                      <MapPin size={10} className="shrink-0" />
                      <span className="truncate">{p.city || "—"}{p.state ? `, ${p.state}` : ""}</span>
                    </div>
                  </div>
                  <ChevronRight size={15} className={cn("shrink-0 transition-colors", active ? "text-brand-500" : "text-gray-300 group-hover:text-brand-400")} />
                </div>
                <div className="text-[11px] text-gray-500 mt-1.5">
                  Seu preço: <span className="font-semibold text-gray-700">{p.base_price_cents > 0 ? `${BRL(p.base_price_cents)}/noite` : "não definido"}</span>
                </div>
              </button>
            );
          })}
          {filtered.length === 0 && (
            <div className="text-xs text-gray-400 px-2 py-4 text-center">Nenhum imóvel encontrado.</div>
          )}
        </div>
      </aside>

      {/* Selected property analysis */}
      <section className="min-w-0">
        {selected ? (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 lg:p-6">
            <div className="flex items-center gap-2 mb-4">
              <HomeIcon size={16} className="text-brand-600" />
              <h2 className="text-sm font-bold text-gray-900">{selected.name}</h2>
              {selected.city && <span className="text-xs text-gray-400">· {selected.city}{selected.state ? `, ${selected.state}` : ""}</span>}
            </div>
            <MarketPanel
              key={selected.id}
              propertyId={selected.id}
              canRun={canRun}
              propertyName={selected.name}
              propertyLat={selected.latitude}
              propertyLng={selected.longitude}
              propertyBedrooms={selected.bedrooms}
            />
          </div>
        ) : (
          <div className="text-sm text-gray-500 p-6">Selecione um imóvel.</div>
        )}
      </section>
    </div>
  );
}
