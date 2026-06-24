"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RefreshCw, ExternalLink, AlertTriangle, CheckCircle2 } from "lucide-react";
import { formatDate } from "@/lib/utils/format";

interface ChannelSyncPanelProps {
  propertyId: string;
  airbnbIcalUrl: string | null;
  bookingIcalUrl: string | null;
  airbnbListingUrl: string | null;
  bookingListingUrl: string | null;
  airbnbLastSyncedAt: string | null;
  bookingLastSyncedAt: string | null;
}

interface SyncResultRow {
  source: "airbnb" | "booking";
  url: string;
  fetched: number;
  blocking: number;
  inserted: number;
  removed: number;
  synced_at: string;
  error?: string;
}

export function ChannelSyncPanel(props: ChannelSyncPanelProps) {
  const router = useRouter();
  const [syncing, setSyncing] = useState(false);
  const [results, setResults] = useState<SyncResultRow[] | null>(null);
  const [error, setError] = useState("");

  const hasAny = !!(props.airbnbIcalUrl || props.bookingIcalUrl);

  const sync = async () => {
    setSyncing(true);
    setError("");
    setResults(null);
    try {
      const res = await fetch(`/api/properties/${props.propertyId}/sync-calendar`, {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Falha na sincronização");
      setResults(json.data.results);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro na sincronização");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="space-y-3">
      <ChannelRow
        label="Airbnb"
        icalUrl={props.airbnbIcalUrl}
        listingUrl={props.airbnbListingUrl}
        lastSyncedAt={props.airbnbLastSyncedAt}
      />
      <ChannelRow
        label="Booking.com"
        icalUrl={props.bookingIcalUrl}
        listingUrl={props.bookingListingUrl}
        lastSyncedAt={props.bookingLastSyncedAt}
      />

      {hasAny ? (
        <div className="flex items-center justify-between gap-3 pt-3 border-t border-gray-100">
          <div className="text-xs text-gray-500">
            A sincronização traz os bloqueios de calendário dos canais configurados para o calendário local.
          </div>
          <button
            type="button"
            onClick={sync}
            disabled={syncing}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-500 hover:bg-brand-600 text-white font-semibold text-sm transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40 disabled:opacity-50"
          >
            {syncing ? (
              <>
                <Loader2 size={14} aria-hidden="true" className="animate-spin" /> Sincronizando...
              </>
            ) : (
              <>
                <RefreshCw size={14} aria-hidden="true" /> Sincronizar agora
              </>
            )}
          </button>
        </div>
      ) : (
        <div className="text-xs text-gray-400 italic">
          Nenhum canal configurado. Adicione URLs de iCal em Editar para habilitar a sincronização.
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">
          <AlertTriangle size={14} aria-hidden="true" /> {error}
        </div>
      )}

      {results && results.length > 0 && (
        <div className="space-y-2">
          {results.map((r) => (
            <div
              key={r.source}
              className={`text-xs rounded px-3 py-2 border ${
                r.error
                  ? "bg-red-50 border-red-200 text-red-700"
                  : "bg-green-50 border-green-200 text-green-800"
              }`}
            >
              <div className="font-semibold flex items-center gap-1">
                {r.error ? (
                  <AlertTriangle size={12} aria-hidden="true" />
                ) : (
                  <CheckCircle2 size={12} aria-hidden="true" />
                )}
                {r.source === "airbnb" ? "Airbnb" : "Booking.com"}
              </div>
              {r.error ? (
                <div>{r.error}</div>
              ) : (
                <div>
                  {r.inserted} bloqueio{r.inserted === 1 ? "" : "s"} importado{r.inserted === 1 ? "" : "s"} (substituindo {r.removed} anterior{r.removed === 1 ? "" : "es"}),
                  {r.fetched} evento{r.fetched === 1 ? "" : "s"} processado{r.fetched === 1 ? "" : "s"}.
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ChannelRow({
  label,
  icalUrl,
  listingUrl,
  lastSyncedAt,
}: {
  label: string;
  icalUrl: string | null;
  listingUrl: string | null;
  lastSyncedAt: string | null;
}) {
  return (
    <div className="flex items-start justify-between gap-3 text-sm">
      <div className="min-w-0">
        <div className="font-semibold text-gray-900">{label}</div>
        {icalUrl ? (
          <div className="text-xs text-gray-500 truncate" title={icalUrl}>
            {icalUrl}
          </div>
        ) : (
          <div className="text-xs text-gray-400 italic">Nenhuma URL de iCal configurada</div>
        )}
      </div>
      <div className="text-right flex-shrink-0">
        {lastSyncedAt ? (
          <div className="text-[11px] text-gray-500">
            Última sincronização: <span className="font-mono">{formatDate(lastSyncedAt, "dd/MM HH:mm")}</span>
          </div>
        ) : (
          <div className="text-[11px] text-gray-400">Nunca sincronizado</div>
        )}
        {listingUrl && (
          <a
            href={listingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[11px] text-brand-600 hover:text-brand-700 mt-0.5 transition-colors duration-200 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40"
          >
            <ExternalLink size={10} aria-hidden="true" /> Anúncio
          </a>
        )}
      </div>
    </div>
  );
}
