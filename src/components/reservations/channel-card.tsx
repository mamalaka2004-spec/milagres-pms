import { ExternalLink, RefreshCw, Hash } from "lucide-react";
import { CHANNELS } from "@/lib/utils/constants";
import { formatCurrency, formatDate } from "@/lib/utils/format";
import { CopyButton } from "@/components/shared/copy-button";
import { Section } from "@/components/ui";
import type { Channel } from "@/types/database";

interface ChannelCardProps {
  channel: Channel;
  channelRef: string | null;
  platformFeeCents: number;
  netAmountCents: number;
  listingUrl: string | null;
  lastSyncedAt: string | null;
}

const DIRECT_CHANNELS: Channel[] = ["direct", "manual"];

/**
 * "Canal" card for the reservation detail page — surfaces channel-of-origin info:
 * badge, the channel's own reservation reference, a link to the listing, the
 * platform fee + net payout, and when the channel calendar was last synced.
 */
export function ChannelCard({
  channel,
  channelRef,
  platformFeeCents,
  netAmountCents,
  listingUrl,
  lastSyncedAt,
}: ChannelCardProps) {
  const cfg = CHANNELS[channel];
  const isDirect = DIRECT_CHANNELS.includes(channel);
  const hasFee = platformFeeCents > 0;

  return (
    <Section title="Canal">
      <div className="flex items-center gap-2">
        <span
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
          style={{ backgroundColor: `${cfg.color}1a`, color: cfg.color }}
        >
          <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: cfg.color }} />
          {cfg.label}
        </span>
        {isDirect && (
          <span className="text-xs text-gray-400">
            {channel === "manual" ? "Lançada manualmente" : "Reserva direta"}
          </span>
        )}
      </div>

      {channelRef && (
        <div>
          <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-0.5 inline-flex items-center gap-1">
            <Hash size={10} aria-hidden="true" /> Referência no canal
          </div>
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-sm text-gray-900 break-all">{channelRef}</span>
            <CopyButton text={channelRef} label="Copiar referência" />
          </div>
        </div>
      )}

      {(hasFee || (!isDirect && netAmountCents > 0)) && (
        <div className="pt-1 grid grid-cols-2 gap-3">
          <div>
            <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-0.5">Taxa do canal</div>
            <div className="font-semibold text-sm text-red-600 font-mono">
              {hasFee ? `− ${formatCurrency(platformFeeCents)}` : "—"}
            </div>
          </div>
          <div>
            <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-0.5">Repasse líquido</div>
            <div className="font-semibold text-sm text-green-700 font-mono">{formatCurrency(netAmountCents)}</div>
          </div>
        </div>
      )}

      {listingUrl && (
        <a
          href={listingUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 hover:text-brand-800 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40 rounded"
        >
          <ExternalLink size={14} aria-hidden="true" /> Ver anúncio no {cfg.label}
        </a>
      )}

      {lastSyncedAt && (
        <div className="flex items-center gap-1.5 text-[11px] text-gray-400 pt-1 border-t border-gray-100">
          <RefreshCw size={11} aria-hidden="true" />
          Calendário sincronizado em {formatDate(lastSyncedAt, "dd/MM/yyyy HH:mm")}
        </div>
      )}

      {isDirect && !channelRef && !hasFee && (
        <div className="text-xs text-gray-400">Sem taxa de canal nesta reserva.</div>
      )}
    </Section>
  );
}
