"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import {
  TrendingUp, Loader2, AlertCircle, Star, BadgeCheck, RefreshCw, Info, ExternalLink,
  SlidersHorizontal, MapPin, RotateCcw,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { statsFor, haversineKm } from "@/lib/market/analyze";

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
type CompWithDist = Comp & { _distKm: number | null };

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

type BedroomsMode = "any" | "similar" | "exact";

export default function MarketPanel({
  propertyId,
  canRun,
  propertyName = "Seu imóvel",
  propertyLat = null,
  propertyLng = null,
  propertyBedrooms = null,
}: {
  propertyId: string;
  canRun: boolean;
  propertyName?: string;
  propertyLat?: number | null;
  propertyLng?: number | null;
  propertyBedrooms?: number | null;
}) {
  const dd = defaultDates();
  type SourceData = { snapshot: Snapshot; comps: Comp[] };
  const [bySource, setBySource] = useState<Record<string, SourceData>>({});
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<"airbnb" | "booking">("airbnb");
  const [touchedSource, setTouchedSource] = useState(false);
  const [checkIn, setCheckIn] = useState(dd.checkIn);
  const [checkOut, setCheckOut] = useState(dd.checkOut);

  // Search-time params (cost credits when running).
  const [numAdults, setNumAdults] = useState("");
  const [pages, setPages] = useState(1);

  // Comparable filters (instant, no credits — recompute client-side).
  const [showFilters, setShowFilters] = useState(false);
  const [maxKm, setMaxKm] = useState("");
  const [minRating, setMinRating] = useState("");
  const [bedroomsMode, setBedroomsMode] = useState<BedroomsMode>("similar");
  const [onlyPremium, setOnlyPremium] = useState(false);
  const [limit, setLimit] = useState("");

  const load = useCallback(async () => {
    try {
      const data = await api<{ bySource: Record<string, SourceData> }>(`/api/properties/${propertyId}/market`);
      setBySource(data.bySource || {});
      setTouchedSource((touched) => {
        if (!touched) {
          if (data.bySource?.airbnb) setSource("airbnb");
          else if (data.bySource?.booking) setSource("booking");
        }
        return touched;
      });
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
      const adults = parseInt(numAdults, 10);
      await api(`/api/properties/${propertyId}/market`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source,
          check_in: checkIn,
          check_out: checkOut,
          pages,
          ...(adults > 0 ? { num_adults: adults } : {}),
        }),
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
    }
  }

  const current = bySource[source] || null;
  const snapshot = current?.snapshot ?? null;
  const allComps = useMemo(() => current?.comps ?? [], [current]);

  // Apply comparable filters (distance / rating / bedrooms / host / limit), with distance.
  const filtered: CompWithDist[] = useMemo(() => {
    const km = parseFloat(maxKm);
    const rating = parseFloat(minRating);
    const lim = parseInt(limit, 10);
    let list: CompWithDist[] = allComps
      .filter((c) => typeof c.nightly_price === "number" && c.nightly_price! > 0)
      .map((c) => {
        const dist =
          propertyLat != null && propertyLng != null && c.latitude != null && c.longitude != null
            ? Math.round(haversineKm(propertyLat, propertyLng, c.latitude, c.longitude) * 10) / 10
            : null;
        return { ...c, _distKm: dist };
      });

    if (!Number.isNaN(km) && km > 0) list = list.filter((c) => c._distKm == null || c._distKm <= km);
    if (!Number.isNaN(rating) && rating > 0) list = list.filter((c) => c.rating != null && c.rating >= rating);
    if (source === "airbnb" && bedroomsMode !== "any" && propertyBedrooms != null) {
      list = list.filter(
        (c) =>
          c.bedrooms != null &&
          (bedroomsMode === "exact" ? c.bedrooms === propertyBedrooms : Math.abs(c.bedrooms - propertyBedrooms) <= 1)
      );
    }
    if (onlyPremium) list = list.filter((c) => c.is_superhost);

    list.sort((a, b) => (a._distKm ?? 1e9) - (b._distKm ?? 1e9) || (a.nightly_price! - b.nightly_price!));
    if (!Number.isNaN(lim) && lim > 0) list = list.slice(0, lim);
    return list;
  }, [allComps, maxKm, minRating, bedroomsMode, onlyPremium, limit, source, propertyLat, propertyLng, propertyBedrooms]);

  // Live stats from the filtered set.
  const stats = useMemo(
    () =>
      statsFor(
        filtered.map((c) => ({
          nightlyPrice: c.nightly_price,
          isSuperhost: c.is_superhost,
          guestFavorite: c.guest_favorite,
        }))
      ),
    [filtered]
  );

  const filtersActive =
    !!maxKm || !!minRating || onlyPremium || !!limit || (source === "airbnb" && bedroomsMode !== "similar");
  function resetFilters() {
    setMaxKm(""); setMinRating(""); setBedroomsMode("similar"); setOnlyPremium(false); setLimit("");
  }

  const your = snapshot?.your_nightly ?? null;
  const suggested = stats.suggestedNightly;
  const delta = your != null && suggested != null ? suggested - your : null;
  const deltaPct = your && suggested ? Math.round(((suggested - your) / your) * 100) : null;
  const ratingMax = source === "booking" ? 10 : 5;

  const inputCls =
    "h-9 rounded-lg border border-gray-200 bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40 disabled:opacity-60";

  return (
    <div className="space-y-4">
      {/* Run controls */}
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Canal</label>
          <select
            value={source}
            onChange={(e) => { setTouchedSource(true); setSource(e.target.value as "airbnb" | "booking"); }}
            disabled={running}
            className={inputCls}
          >
            <option value="airbnb">Airbnb (1 crédito)</option>
            <option value="booking">Booking (5 créditos)</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Check-in</label>
          <input type="date" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} disabled={!canRun || running} className={inputCls} />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Check-out</label>
          <input type="date" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} disabled={!canRun || running} className={inputCls} />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Hóspedes</label>
          <input type="number" min={1} max={16} placeholder="auto" value={numAdults} onChange={(e) => setNumAdults(e.target.value)} disabled={!canRun || running} className={cn(inputCls, "w-24")} />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Páginas</label>
          <select value={pages} onChange={(e) => setPages(parseInt(e.target.value, 10))} disabled={!canRun || running} className={inputCls}>
            <option value={1}>1</option>
            <option value={2}>2</option>
            <option value={3}>3</option>
          </select>
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
          Ainda não há análise neste canal. Escolha as datas e clique em <strong>Analisar mercado</strong> para
          comparar com anúncios próximos no {source === "booking" ? "Booking" : "Airbnb"}.
        </div>
      ) : (
        <>
          {/* Filters */}
          <div className="rounded-xl border border-gray-200 bg-white">
            <button
              onClick={() => setShowFilters((s) => !s)}
              className="w-full flex items-center justify-between gap-2 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors rounded-xl cursor-pointer"
            >
              <span className="inline-flex items-center gap-2"><SlidersHorizontal size={14} /> Filtros de comparação{filtersActive && <span className="text-[10px] font-semibold text-brand-700 bg-brand-500/10 px-1.5 py-0.5 rounded-full">ativos</span>}</span>
              <span className="text-[11px] text-gray-400">{filtered.length} de {allComps.length}</span>
            </button>
            {showFilters && (
              <div className="px-3 pb-3 pt-1 border-t border-gray-100 space-y-3">
                <div className="flex flex-wrap items-end gap-3">
                  <div>
                    <label className="block text-[11px] text-gray-500 mb-1">Distância máx (km)</label>
                    <input type="number" min={0} step={0.5} placeholder="qualquer" value={maxKm} onChange={(e) => setMaxKm(e.target.value)} className={cn(inputCls, "w-28")} />
                  </div>
                  <div>
                    <label className="block text-[11px] text-gray-500 mb-1">Avaliação mín (0–{ratingMax})</label>
                    <input type="number" min={0} max={ratingMax} step={0.1} placeholder="qualquer" value={minRating} onChange={(e) => setMinRating(e.target.value)} className={cn(inputCls, "w-28")} />
                  </div>
                  {source === "airbnb" && (
                    <div>
                      <label className="block text-[11px] text-gray-500 mb-1">Quartos {propertyBedrooms != null ? `(seu: ${propertyBedrooms})` : ""}</label>
                      <select value={bedroomsMode} onChange={(e) => setBedroomsMode(e.target.value as BedroomsMode)} className={inputCls} disabled={propertyBedrooms == null}>
                        <option value="any">Qualquer</option>
                        <option value="similar">Semelhante (±1)</option>
                        <option value="exact">Exato</option>
                      </select>
                    </div>
                  )}
                  <div>
                    <label className="block text-[11px] text-gray-500 mb-1">Máx resultados</label>
                    <input type="number" min={1} placeholder="todos" value={limit} onChange={(e) => setLimit(e.target.value)} className={cn(inputCls, "w-24")} />
                  </div>
                  <label className="inline-flex items-center gap-2 h-9 text-sm text-gray-700 cursor-pointer">
                    <input type="checkbox" checked={onlyPremium} onChange={(e) => setOnlyPremium(e.target.checked)} className="rounded border-gray-300 text-brand-500 focus:ring-brand-400/40" />
                    Só {source === "booking" ? "Preferred" : "Superhost"}
                  </label>
                  {filtersActive && (
                    <button onClick={resetFilters} className="h-9 inline-flex items-center gap-1 px-2 text-xs text-gray-500 hover:text-gray-800 cursor-pointer">
                      <RotateCcw size={12} /> Limpar
                    </button>
                  )}
                </div>
                <p className="text-[11px] text-gray-400">
                  Filtros recalculam a tarifa sugerida na hora, sem gastar créditos. Critérios como piscina,
                  amenities, estrutura e capacidade exata exigem a página de detalhe de cada anúncio (1 crédito por
                  anúncio) — posso ligar isso como análise aprofundada se quiser.
                </p>
              </div>
            )}
          </div>

          {/* Headline cards (reflect the active filters) */}
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
              <div className="text-sm font-bold text-gray-900">{BRL(stats.priceP25)} – {BRL(stats.priceP75)}</div>
              <div className="text-[11px] text-gray-400 mt-0.5">mediana {BRL(stats.priceMedian)}</div>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-3">
              <div className="text-xs text-gray-500">Amostra</div>
              <div className="text-sm font-bold text-gray-900">{stats.sampleSize} comparáveis{filtersActive ? ` de ${allComps.length}` : ""}</div>
              <div className="text-[11px] text-gray-400 mt-0.5">{snapshot.total_results ?? "?"} no mercado</div>
            </div>
          </div>

          <div className="text-[11px] text-gray-400">
            {snapshot.nights} noite(s) · {snapshot.check_in} → {snapshot.check_out} · {snapshot.credits_used} crédito(s) ·
            atualizado em {new Date(snapshot.captured_at).toLocaleString("pt-BR")}
          </div>

          {/* Comps list */}
          {filtered.length > 0 ? (
            <div className="space-y-1.5">
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Anúncios próximos</div>
              <div className="max-h-80 overflow-y-auto rounded-xl border border-gray-200 divide-y divide-gray-100">
                {filtered.map((c) => (
                  <a key={c.id} href={c.url || "#"} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-3 p-2.5 hover:bg-gray-50 transition-colors duration-150 group">
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
                      <div className="text-[11px] text-gray-400 flex items-center gap-2 flex-wrap">
                        {c._distKm != null && <span className="inline-flex items-center gap-0.5"><MapPin size={10} />{c._distKm} km</span>}
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
          ) : (
            <div className="text-sm text-gray-500 bg-gray-50 border border-gray-200 rounded-lg px-3 py-3">
              Nenhum comparável passou nos filtros. Afrouxe os critérios acima.
            </div>
          )}

          {/* Map of property + nearby listings */}
          {filtered.some((c) => c.latitude != null && c.longitude != null) && (
            <div className="space-y-1.5">
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Mapa</div>
              <MarketMap
                propertyName={propertyName}
                propertyLat={propertyLat}
                propertyLng={propertyLng}
                comps={filtered.map((c) => ({
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
