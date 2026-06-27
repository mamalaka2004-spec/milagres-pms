"use client";

import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import {
  TrendingUp, Loader2, AlertCircle, Star, BadgeCheck, RefreshCw, Info, ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";

const MarketMap = dynamic(() => import("./market-map"), {
  ssr: false,
  loading: () => <div className="h-72 w-full rounded-xl border border-gray-200 bg-gray-50 animate-pulse" />,
});

interface Snapshot {
  id: string;
  source: string;
  check_in: string;
  check_out: string;
  nights: number;
  radius_km: number | null;
  total_results: number | null;
  sample_size: number;
  price_p25: number | null;
  price_median: number | null;
  price_p75: number | null;
  suggested_nightly: number | null;
  your_nightly: number | null;
  credits_used: number;
  captured_at: string;
}
interface Comp {
  id: string;
  source: string;
  url: string | null;
  name: string | null;
  title: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  bedrooms: number | null;
  nightly_price: number | null;
  rating: number | null;
  reviews_count: number | null;
  is_superhost: boolean;
  guest_favorite: boolean;
  thumbnail: string | null;
}

interface ApiResp<T> { success: boolean; data?: T; error?: string }
async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init);
  const json = (await res.json()) as ApiResp<T>;
  if (!json.success) throw new Error(json.error || `HTTP ${res.status}`);
  return json.data as T;
}

const BRL = (n: number | null | undefined) =>
  n == null ? "—" : n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

/** Default dates: next Friday → Sunday (a typical 2-night weekend). */
function defaultDates(): { checkIn: string; checkOut: string } {
  const d = new Date();
  const day = d.getDay();
  const toFri = (5 - day + 7) % 7 || 7;
  const fri = new Date(d.getTime() + toFri * 86_400_000);
  const sun = new Date(fri.getTime() + 2 * 86_400_000);
  const iso = (x: Date) => x.toISOString().slice(0, 10);
  return { checkIn: iso(fri), checkOut: iso(sun) };
}

export default function MarketPanel({
  propertyId,
  canRun,
  propertyName = "Seu imóvel",
  propertyLat = null,
  propertyLng = null,
}: {
  propertyId: string;
  canRun: boolean;
  propertyName?: string;
  propertyLat?: number | null;
  propertyLng?: number | null;
}) {
  const dd = defaultDates();
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [comps, setComps] = useState<Comp[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<"airbnb" | "booking">("airbnb");
  const [checkIn, setCheckIn] = useState(dd.checkIn);
  const [checkOut, setCheckOut] = useState(dd.checkOut);

  const load = useCallback(async () => {
    try {
      const data = await api<{ snapshot: Snapshot | null; comps: Comp[] }>(`/api/properties/${propertyId}/market`);
      setSnapshot(data.snapshot);
      setComps(data.comps);
      if (data.snapshot) setSource(data.snapshot.source === "booking" ? "booking" : "airbnb");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [propertyId]);

  useEffect(() => { load(); }, [load]);

  async function run() {
    if (running) return;
    setRunning(true);
    setError(null);
    try {
      await api(`/api/properties/${propertyId}/market`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source, check_in: checkIn, check_out: checkOut }),
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
    }
  }

  const your = snapshot?.your_nightly ?? null;
  const suggested = snapshot?.suggested_nightly ?? null;
  const delta = your != null && suggested != null ? suggested - your : null;
  const deltaPct = your && suggested ? Math.round(((suggested - your) / your) * 100) : null;

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Canal</label>
          <select
            value={source}
            onChange={(e) => setSource(e.target.value as "airbnb" | "booking")}
            disabled={!canRun || running}
            className="h-9 rounded-lg border border-gray-200 bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40 disabled:opacity-60"
          >
            <option value="airbnb">Airbnb (1 crédito)</option>
            <option value="booking">Booking (5 créditos)</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Check-in</label>
          <input type="date" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} disabled={!canRun || running}
            className="h-9 rounded-lg border border-gray-200 bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40 disabled:opacity-60" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Check-out</label>
          <input type="date" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} disabled={!canRun || running}
            className="h-9 rounded-lg border border-gray-200 bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40 disabled:opacity-60" />
        </div>
        <button
          onClick={run}
          disabled={!canRun || running}
          className="h-9 inline-flex items-center gap-2 px-4 rounded-lg bg-brand-500 hover:bg-brand-600 text-white font-semibold text-sm transition-colors duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {running ? <Loader2 className="animate-spin" size={15} /> : <RefreshCw size={15} />}
          {running ? "Analisando…" : "Analisar mercado"}
        </button>
        {!canRun && <span className="text-xs text-gray-400">Somente admin/gerente pode rodar a análise.</span>}
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
          <AlertCircle size={15} /> {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-gray-500 py-6">
          <Loader2 className="animate-spin" size={16} /> Carregando…
        </div>
      ) : !snapshot ? (
        <div className="flex items-start gap-2 text-sm text-gray-500 bg-gray-50 border border-gray-200 rounded-lg px-3 py-3">
          <Info size={15} className="mt-0.5 shrink-0" />
          Ainda não há análise para este imóvel. Escolha as datas e clique em <strong>Analisar mercado</strong> para
          comparar com anúncios próximos no {source === "booking" ? "Booking" : "Airbnb"}.
        </div>
      ) : (
        <>
          {/* Headline cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-xl border border-gray-200 bg-white p-3">
              <div className="text-xs text-gray-500">Seu preço/noite</div>
              <div className="text-lg font-bold text-gray-900">{BRL(your)}</div>
            </div>
            <div className="rounded-xl border border-brand-300 bg-brand-500/[0.05] p-3">
              <div className="text-xs text-brand-700 flex items-center gap-1"><TrendingUp size={12} /> Tarifa sugerida</div>
              <div className="text-lg font-bold text-brand-700">{BRL(suggested)}</div>
              {delta != null && (
                <div className={cn("text-[11px] font-semibold mt-0.5", delta >= 0 ? "text-emerald-600" : "text-amber-600")}>
                  {delta >= 0 ? "+" : ""}{BRL(delta)} {deltaPct != null && `(${deltaPct >= 0 ? "+" : ""}${deltaPct}%)`}
                </div>
              )}
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-3">
              <div className="text-xs text-gray-500">Faixa do mercado</div>
              <div className="text-sm font-bold text-gray-900">{BRL(snapshot.price_p25)} – {BRL(snapshot.price_p75)}</div>
              <div className="text-[11px] text-gray-400 mt-0.5">mediana {BRL(snapshot.price_median)}</div>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-3">
              <div className="text-xs text-gray-500">Amostra</div>
              <div className="text-sm font-bold text-gray-900">{snapshot.sample_size} comparáveis</div>
              <div className="text-[11px] text-gray-400 mt-0.5">
                {snapshot.total_results ?? "?"} no raio de {snapshot.radius_km ?? "?"}km
              </div>
            </div>
          </div>

          <div className="text-[11px] text-gray-400">
            {snapshot.nights} noite(s) · {snapshot.check_in} → {snapshot.check_out} · {snapshot.credits_used} crédito(s) ·
            atualizado em {new Date(snapshot.captured_at).toLocaleString("pt-BR")}
          </div>

          {/* Comps list */}
          {comps.length > 0 && (
            <div className="space-y-1.5">
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Anúncios próximos</div>
              <div className="max-h-80 overflow-y-auto rounded-xl border border-gray-200 divide-y divide-gray-100">
                {comps.map((c) => (
                  <a
                    key={c.id}
                    href={c.url || "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 p-2.5 hover:bg-gray-50 transition-colors duration-150 group"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {c.thumbnail ? (
                      <img src={c.thumbnail} alt="" className="w-12 h-12 rounded-lg object-cover shrink-0 bg-gray-100" loading="lazy" />
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-gray-100 shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-800 truncate flex items-center gap-1">
                        {c.name || c.title || "Anúncio"}
                        <ExternalLink size={11} className="text-gray-300 group-hover:text-brand-500 shrink-0" />
                      </div>
                      <div className="text-[11px] text-gray-400 flex items-center gap-2">
                        {c.bedrooms != null && <span>{c.bedrooms === 0 ? "Studio" : `${c.bedrooms} qto`}</span>}
                        {c.rating != null && (
                          <span className="inline-flex items-center gap-0.5">
                            <Star size={10} className="fill-amber-400 text-amber-400" />
                            {c.rating}{c.source === "booking" ? "/10" : ""} ({c.reviews_count ?? 0})
                          </span>
                        )}
                        {c.is_superhost && (
                          <span className="inline-flex items-center gap-0.5 text-brand-600">
                            <BadgeCheck size={10} />{c.source === "booking" ? "Preferred" : "Superhost"}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-sm font-bold text-gray-900 shrink-0">{BRL(c.nightly_price)}<span className="text-[10px] font-normal text-gray-400">/noite</span></div>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Map of property + nearby listings */}
          {comps.some((c) => c.latitude != null && c.longitude != null) && (
            <div className="space-y-1.5">
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Mapa</div>
              <MarketMap
                propertyName={propertyName}
                propertyLat={propertyLat}
                propertyLng={propertyLng}
                comps={comps.map((c) => ({
                  id: c.id, name: c.name, title: c.title, latitude: c.latitude, longitude: c.longitude,
                  nightly_price: c.nightly_price, source: c.source, url: c.url, is_superhost: c.is_superhost,
                }))}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}
