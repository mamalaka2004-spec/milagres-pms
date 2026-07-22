"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Loader2,
  Clock,
  CheckCheck,
  Check,
  Eye,
  MessageCircleReply,
  Ban,
  XCircle,
  SkipForward,
  Radio,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetBody,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils/cn";
import { api } from "@/lib/chat/utils";
import { formatWhen, formatCountdown, formatWait } from "@/lib/campaigns/format";
import {
  CAMPAIGN_STATUS_META,
  RECIPIENT_STATUS_META,
  type Campaign,
  type CampaignRecipient,
  type RecipientStatus,
} from "@/types/campaign";

interface LiveStep {
  step_id: string;
  order_index: number;
  label: string;
  kind: string;
  wait_hours: number;
  waiting: number;
  next_send_at: string | null;
  sent: number;
}

interface LiveData {
  campaign: Campaign;
  steps: LiveStep[];
  next_send_at: string | null;
  counts: Record<string, number>;
  recipients: (CampaignRecipient & { step_label: string })[];
}

const STATUS_ICON: Record<string, typeof Check> = {
  pending: Clock,
  sending: Loader2,
  sent: Check,
  delivered: CheckCheck,
  read: Eye,
  replied: MessageCircleReply,
  opted_out: Ban,
  failed: XCircle,
  skipped: SkipForward,
};

/** Ordem de exibição dos filtros de status. */
const FILTERS: { id: RecipientStatus | "all"; label: string }[] = [
  { id: "all", label: "Todos" },
  { id: "pending", label: "Na fila" },
  { id: "sent", label: "Enviados" },
  { id: "replied", label: "Responderam" },
  { id: "failed", label: "Falhas" },
  { id: "skipped", label: "Pulados" },
  { id: "opted_out", label: "Opt-out" },
];

/**
 * Acompanhamento ao vivo do disparo: quem já recebeu, quem está na fila e
 * quando cada follow-up sai. Atualiza sozinho a cada 5s enquanto a campanha
 * está ativa (o worker envia 1 por minuto, então isso é folgado).
 */
export function CampaignLiveDrawer({
  campaignId,
  open,
  onOpenChange,
}: {
  campaignId: string | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const [data, setData] = useState<LiveData | null>(null);
  const [filter, setFilter] = useState<RecipientStatus | "all">("all");
  const [tick, setTick] = useState(0); // força recálculo do "em X min"
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    if (!campaignId) return;
    try {
      setData(await api<LiveData>(`/api/campaigns/${campaignId}/live`));
    } catch {
      /* mantém o último estado */
    }
  }, [campaignId]);

  useEffect(() => {
    if (!open) return;
    load();
    timer.current = setInterval(() => {
      setTick((t) => t + 1);
      load();
    }, 5000);
    return () => {
      if (timer.current) clearInterval(timer.current);
      timer.current = null;
    };
  }, [open, load]);

  const campaign = data?.campaign;
  const active = campaign?.status === "sending" || campaign?.status === "scheduled";
  const meta = campaign ? CAMPAIGN_STATUS_META[campaign.status] : null;
  const shown = (data?.recipients ?? []).filter((r) => filter === "all" || r.status === filter);
  void tick;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 pr-6">
            <span className="truncate">{campaign?.name ?? "Acompanhar envios"}</span>
            {meta && (
              <span
                className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold"
                style={{ color: meta.color, background: `${meta.color}18` }}
              >
                {meta.label}
              </span>
            )}
          </SheetTitle>
        </SheetHeader>

        <SheetBody className="space-y-4">
          {!data ? (
            <div className="flex justify-center py-16 text-gray-400">
              <Loader2 className="animate-spin" size={20} />
            </div>
          ) : (
            <>
              {/* Próximo disparo — a informação que o painel escondia */}
              <div
                className={cn(
                  "rounded-xl border p-3",
                  active ? "border-brand-200 bg-brand-50/50" : "border-gray-200 bg-gray-50/50"
                )}
              >
                <div className="flex items-center gap-2">
                  {active ? (
                    <Radio size={14} className="animate-pulse text-brand-600" />
                  ) : (
                    <Clock size={14} className="text-gray-400" />
                  )}
                  <span className="text-xs font-semibold text-gray-700">
                    {active ? "Próximo envio" : "Campanha não está enviando"}
                  </span>
                </div>
                {active && (
                  <p className="mt-1 text-sm text-gray-900">
                    {data.next_send_at ? (
                      <>
                        <b>{formatWhen(data.next_send_at)}</b>{" "}
                        <span className="text-gray-500">({formatCountdown(data.next_send_at)})</span>
                      </>
                    ) : (
                      "sem ninguém na fila"
                    )}
                  </p>
                )}
                <p className="mt-1 text-[11px] text-gray-500">
                  Janela {campaign?.schedule?.start_time}–{campaign?.schedule?.end_time} · intervalo{" "}
                  {campaign?.min_interval_seconds}–{campaign?.max_interval_seconds}s entre envios
                </p>
              </div>

              {/* Cadência: o que é cada passo e quando sai */}
              <div>
                <h4 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                  Cadência
                </h4>
                <ul className="space-y-1.5">
                  {data.steps.map((s) => (
                    <li key={s.step_id} className="rounded-lg border border-gray-200 px-3 py-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-semibold text-gray-800">{s.label}</span>
                        {s.kind === "ai" && (
                          <span className="rounded-full bg-purple-50 px-1.5 py-0.5 text-[9px] font-semibold text-purple-600">
                            IA
                          </span>
                        )}
                        <span className="text-[10px] text-gray-400">
                          {s.order_index === 0
                            ? "sai no disparo"
                            : `${formatWait(s.wait_hours)} sem resposta`}
                        </span>
                        <span className="ml-auto text-[11px] text-gray-500">
                          {s.sent} enviada(s)
                        </span>
                      </div>
                      {s.waiting > 0 && (
                        <div className="mt-1 flex items-center gap-1.5 text-[11px] text-brand-700">
                          <Clock size={11} />
                          {s.waiting} aguardando · próximo {formatWhen(s.next_send_at)}
                          <span className="text-gray-400">({formatCountdown(s.next_send_at)})</span>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Filtros por status */}
              <div className="flex flex-wrap gap-1">
                {FILTERS.map((f) => {
                  const n = f.id === "all" ? data.recipients.length : data.counts[f.id] ?? 0;
                  if (f.id !== "all" && n === 0) return null;
                  return (
                    <button
                      key={f.id}
                      onClick={() => setFilter(f.id)}
                      className={cn(
                        "rounded-full px-2.5 py-1 text-[11px] font-medium",
                        filter === f.id ? "bg-brand-500 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      )}
                    >
                      {f.label} {n}
                    </button>
                  );
                })}
              </div>

              {/* Fila de destinatários */}
              <ul className="divide-y divide-gray-50 rounded-xl border border-gray-200">
                {shown.length === 0 ? (
                  <li className="px-3 py-6 text-center text-xs text-gray-400">
                    Nenhum destinatário neste filtro.
                  </li>
                ) : (
                  shown.map((r) => {
                    const rm = RECIPIENT_STATUS_META[r.status];
                    const Icon = STATUS_ICON[r.status] ?? Clock;
                    return (
                      <li key={r.id} className="flex items-center gap-2.5 px-3 py-2">
                        <Icon
                          size={14}
                          className={cn("shrink-0", r.status === "sending" && "animate-spin")}
                          style={{ color: rm.color }}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm text-gray-800">
                            {r.name || r.phone_e164}
                          </div>
                          <div className="truncate text-[11px] text-gray-400">
                            {r.step_label}
                            {r.status === "pending" && r.scheduled_for && (
                              <> · sai {formatWhen(r.scheduled_for)}</>
                            )}
                            {(r.status === "sent" || r.status === "replied") && r.sent_at && (
                              <> · enviada {formatWhen(r.sent_at)}</>
                            )}
                            {r.read_at && <> · lida</>}
                            {r.error && <> · {r.error}</>}
                          </div>
                        </div>
                        <span
                          className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold"
                          style={{ color: rm.color, background: `${rm.color}18` }}
                        >
                          {rm.label}
                        </span>
                      </li>
                    );
                  })
                )}
              </ul>

              {active && (
                <p className="text-center text-[10px] text-gray-400">
                  Atualizando automaticamente a cada 5 segundos
                </p>
              )}
            </>
          )}
        </SheetBody>
      </SheetContent>
    </Sheet>
  );
}
