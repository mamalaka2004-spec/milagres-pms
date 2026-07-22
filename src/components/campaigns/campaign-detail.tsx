"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Send,
  CheckCheck,
  Eye,
  MessageCircleReply,
  Ban,
  XCircle,
  Loader2,
  Pause,
  Play,
  Clock,
  Radio,
} from "lucide-react";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from "recharts";
import { api } from "@/lib/chat/utils";
import { toast } from "@/components/ui/use-toast";
import { StatsCard } from "@/components/dashboard/stats-card";
import { CampaignLiveDrawer } from "./campaign-live-drawer";
import { formatWhen, formatCountdown, formatWait } from "@/lib/campaigns/format";
import {
  CAMPAIGN_STATUS_META,
  RECIPIENT_STATUS_META,
  type Campaign,
  type CampaignRecipient,
} from "@/types/campaign";

interface Metrics {
  campaign: Campaign;
  totals: {
    total: number;
    queued: number;
    reached: number;
    delivered: number;
    read: number;
    replied: number;
    opted_out: number;
    failed: number;
    skipped: number;
  };
  rates: { delivery: number; read: number; response: number };
  daily: { day: string; enviadas: number; respostas: number }[];
  steps: { step_id: string | null; kind: string; label: string; sent: number; delivered: number; read: number }[];
}

interface LiveStepInfo {
  step_id: string;
  wait_hours: number;
  waiting: number;
  next_send_at: string | null;
}

export function CampaignDetail({ campaignId }: { campaignId: string }) {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [recipients, setRecipients] = useState<CampaignRecipient[]>([]);
  const [liveSteps, setLiveSteps] = useState<LiveStepInfo[]>([]);
  const [nextSendAt, setNextSendAt] = useState<string | null>(null);
  const [watching, setWatching] = useState(false);
  const [busy, setBusy] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    try {
      const [m, c, live] = await Promise.all([
        api<Metrics>(`/api/campaigns/${campaignId}/metrics`),
        api<Campaign & { recipients: CampaignRecipient[] }>(`/api/campaigns/${campaignId}`),
        api<{ steps: LiveStepInfo[]; next_send_at: string | null }>(`/api/campaigns/${campaignId}/live`),
      ]);
      setMetrics(m);
      setRecipients(c.recipients || []);
      setLiveSteps(live.steps || []);
      setNextSendAt(live.next_send_at);
    } catch {
      /* mantém último estado */
    }
  }, [campaignId]);

  useEffect(() => {
    load();
  }, [load]);

  // Auto-refresh enquanto a campanha estiver ativa.
  useEffect(() => {
    const active =
      metrics?.campaign.status === "sending" || metrics?.campaign.status === "scheduled";
    if (active && !timer.current) timer.current = setInterval(load, 10_000);
    if (!active && timer.current) {
      clearInterval(timer.current);
      timer.current = null;
    }
    return () => {
      if (timer.current) {
        clearInterval(timer.current);
        timer.current = null;
      }
    };
  }, [metrics?.campaign.status, load]);

  async function control(action: "pause" | "resume" | "cancel") {
    setBusy(true);
    try {
      await api(`/api/campaigns/${campaignId}/control`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      toast({
        title: action === "pause" ? "Campanha pausada" : action === "resume" ? "Campanha retomada" : "Campanha cancelada",
        variant: "success",
      });
      load();
    } catch (e) {
      toast({ title: "Erro", description: e instanceof Error ? e.message : "", variant: "error" });
    } finally {
      setBusy(false);
    }
  }

  if (!metrics) {
    return (
      <div className="flex justify-center py-24 text-gray-400">
        <Loader2 className="animate-spin" size={22} />
      </div>
    );
  }

  const { campaign, totals, rates, daily, steps } = metrics;
  const meta = CAMPAIGN_STATUS_META[campaign.status];
  const canPause = campaign.status === "sending" || campaign.status === "scheduled";
  const canResume = campaign.status === "paused";
  const canCancel = !["sent", "cancelled", "failed"].includes(campaign.status);

  return (
    <div className="space-y-4 lg:space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/campaigns" className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700">
          <ArrowLeft size={18} />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="truncate text-xl font-bold text-gray-900">{campaign.name}</h1>
            <span
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
              style={{ color: meta.color, background: `${meta.color}18` }}
            >
              {campaign.status === "sending" && <Loader2 size={10} className="animate-spin" />}
              {meta.label}
            </span>
          </div>
          <p className="text-xs text-gray-500">
            {totals.total} destinatário(s) · {steps.length ? `${steps.length} passo(s)` : "sem passos"} ·
            intervalo {campaign.min_interval_seconds}–{campaign.max_interval_seconds}s
          </p>
          {(canPause || canResume) && (
            <p className="mt-0.5 inline-flex items-center gap-1 text-xs font-medium text-brand-700">
              <Clock size={11} />
              {canResume ? (
                <span className="font-normal text-gray-500">pausada — retome para voltar a enviar</span>
              ) : nextSendAt ? (
                <>
                  Próximo envio {formatWhen(nextSendAt)}
                  <span className="font-normal text-gray-400">({formatCountdown(nextSendAt)})</span>
                </>
              ) : (
                <span className="font-normal text-gray-400">nenhum envio na fila</span>
              )}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setWatching(true)}
            className="inline-flex items-center gap-1 rounded-lg bg-brand-50 px-3 py-1.5 text-xs font-medium text-brand-700 hover:bg-brand-100"
          >
            <Radio size={13} className={canPause ? "animate-pulse" : undefined} /> Acompanhar envios
          </button>
          {canPause && (
            <button onClick={() => control("pause")} disabled={busy} className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50">
              <Pause size={13} /> Pausar
            </button>
          )}
          {canResume && (
            <button onClick={() => control("resume")} disabled={busy} className="inline-flex items-center gap-1 rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-600 disabled:opacity-50">
              <Play size={13} /> Retomar
            </button>
          )}
          {canCancel && (
            <button onClick={() => control("cancel")} disabled={busy} className="inline-flex items-center gap-1 rounded-lg border border-red-100 px-3 py-1.5 text-xs font-medium text-red-500 hover:bg-red-50 disabled:opacity-50">
              <XCircle size={13} /> Cancelar
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatsCard label="Enviadas" value={String(totals.reached)} subtitle={`${totals.queued} na fila`} icon={Send} />
        <StatsCard label="Entregues" value={String(totals.delivered)} subtitle={`${rates.delivery}% das enviadas`} icon={CheckCheck} />
        <StatsCard label="Lidas" value={String(totals.read)} subtitle={`${rates.read}% das enviadas`} icon={Eye} />
        <StatsCard label="Responderam" value={String(totals.replied)} subtitle={`taxa de resposta ${rates.response}%`} icon={MessageCircleReply} trend={rates.response > 0 ? `${rates.response}%` : undefined} trendUp={rates.response > 0} />
        <StatsCard label="Opt-out" value={String(totals.opted_out)} subtitle="pediram para sair" icon={Ban} />
        <StatsCard label="Falhas" value={String(totals.failed)} subtitle={`${totals.skipped} pulados`} icon={XCircle} />
      </div>

      {/* Gráfico diário */}
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <h3 className="mb-3 text-sm font-semibold text-gray-900">Envios × respostas por dia</h3>
        {daily.length === 0 ? (
          <div className="flex h-40 items-center justify-center text-sm text-gray-400">
            Nenhum envio ainda.
          </div>
        ) : (
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={daily.map((d) => ({ ...d, name: d.day.slice(5).split("-").reverse().join("/") }))}>
                <XAxis dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} width={28} />
                <Tooltip cursor={{ fill: "rgba(0,0,0,0.04)" }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="enviadas" name="Enviadas" fill="#6B7F5E" radius={[3, 3, 0, 0]} />
                <Bar dataKey="respostas" name="Respostas" fill="#3b82f6" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Por passo — inclui quando cada follow-up sai */}
      {steps.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-sm font-semibold text-gray-900">Cadência por passo</h3>
            <p className="text-[11px] text-gray-400">
              Follow-ups saem só para quem <b>não respondeu</b>, no prazo configurado.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-[11px] uppercase tracking-wide text-gray-400">
                  <th className="pb-2 pr-4 font-medium">Passo</th>
                  <th className="pb-2 pr-4 font-medium">Quando sai</th>
                  <th className="pb-2 pr-4 font-medium">Enviadas</th>
                  <th className="pb-2 pr-4 font-medium">Entregues</th>
                  <th className="pb-2 pr-4 font-medium">Lidas</th>
                  <th className="pb-2 font-medium">Na fila</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {steps.map((s, i) => {
                  const live = liveSteps.find((l) => l.step_id === s.step_id);
                  return (
                    <tr key={s.step_id ?? s.label}>
                      <td className="py-2 pr-4">
                        <span className="font-medium text-gray-800">{s.label}</span>
                        {s.kind === "ai" && (
                          <span className="ml-1.5 rounded-full bg-purple-50 px-1.5 py-0.5 text-[9px] font-semibold text-purple-600">
                            IA
                          </span>
                        )}
                      </td>
                      <td className="py-2 pr-4 text-xs text-gray-500">
                        {i === 0
                          ? "no disparo"
                          : `${formatWait(live?.wait_hours ?? 0)} sem resposta`}
                      </td>
                      <td className="py-2 pr-4">{s.sent}</td>
                      <td className="py-2 pr-4">{s.delivered}</td>
                      <td className="py-2 pr-4">{s.read}</td>
                      <td className="py-2 text-xs">
                        {live && live.waiting > 0 ? (
                          <span className="text-brand-700">
                            {live.waiting} · próximo {formatWhen(live.next_send_at)}
                          </span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Destinatários */}
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <h3 className="mb-3 text-sm font-semibold text-gray-900">
          Destinatários <span className="font-normal text-gray-400">({recipients.length})</span>
        </h3>
        {recipients.length === 0 ? (
          <p className="py-4 text-center text-xs text-gray-400">Nenhum destinatário.</p>
        ) : (
          <ul className="divide-y divide-gray-50">
            {recipients.map((r) => {
              const rm = RECIPIENT_STATUS_META[r.status];
              return (
                <li key={r.id} className="flex flex-wrap items-center gap-2 py-2">
                  <div className="min-w-0 flex-1">
                    <span className="truncate text-sm font-medium text-gray-800">
                      {r.name || r.phone_e164}
                    </span>
                    <span className="ml-2 text-[11px] text-gray-400">{r.phone_e164}</span>
                  </div>
                  <span className="text-[11px] text-gray-400">passo {(r.current_step ?? 0) + 1}</span>
                  {r.status === "pending" && r.scheduled_for && (
                    <span className="inline-flex items-center gap-1 text-[11px] text-gray-400">
                      <Clock size={11} />
                      {new Date(r.scheduled_for).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                    </span>
                  )}
                  <span
                    className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold"
                    style={{ color: rm.color, background: `${rm.color}18` }}
                    title={r.error ?? undefined}
                  >
                    {rm.label}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <CampaignLiveDrawer
        campaignId={watching ? campaignId : null}
        open={watching}
        onOpenChange={setWatching}
      />
    </div>
  );
}
