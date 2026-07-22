"use client";

import { useState } from "react";
import { ShieldCheck, ChevronDown, ChevronRight, Flame, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils/cn";

/** Janela utilizável? Fim precisa ser depois do início (espelha o backend). */
export function scheduleWindowIsValid(s: { days: number[]; start_time: string; end_time: string }): boolean {
  const [sh, sm] = (s.start_time || "").split(":").map(Number);
  const [eh, em] = (s.end_time || "").split(":").map(Number);
  if ([sh, sm, eh, em].some(Number.isNaN)) return false;
  return s.days.length > 0 && eh * 60 + em > sh * 60 + sm;
}

/** Config antiban da campanha (colunas da migration 036). */
export interface AntibanConfig {
  min_interval_seconds: number;
  max_interval_seconds: number;
  daily_limit: number;
  hourly_limit: number;
  schedule: { timezone: string; days: number[]; start_time: string; end_time: string };
  simulate_typing: boolean;
  opt_out_keywords: string[];
  skip_active_conversations: boolean;
}

export const ANTIBAN_DEFAULTS: AntibanConfig = {
  min_interval_seconds: 30,
  max_interval_seconds: 90,
  daily_limit: 200,
  hourly_limit: 60,
  schedule: { timezone: "America/Sao_Paulo", days: [1, 2, 3, 4, 5, 6], start_time: "09:00", end_time: "19:00" },
  simulate_typing: true,
  opt_out_keywords: ["sair", "parar", "pare", "remover", "descadastrar", "nao quero", "não quero", "stop"],
  skip_active_conversations: true,
};

const DAY_LABELS = ["D", "S", "T", "Q", "Q", "S", "S"];

interface WarmupInfo {
  enabled: boolean;
  startDate: string | null;
  onToggle: (enabled: boolean) => void;
}

export function AntibanSettings({
  value,
  onChange,
  warmup,
}: {
  value: AntibanConfig;
  onChange: (v: AntibanConfig) => void;
  /** Estado de warmup da linha selecionada (opcional). */
  warmup?: WarmupInfo | null;
}) {
  const [open, setOpen] = useState(false);
  const windowOk = scheduleWindowIsValid(value.schedule);

  function patch(p: Partial<AntibanConfig>) {
    onChange({ ...value, ...p });
  }
  function toggleDay(d: number) {
    const days = value.schedule.days.includes(d)
      ? value.schedule.days.filter((x) => x !== d)
      : [...value.schedule.days, d].sort();
    if (days.length === 0) return;
    patch({ schedule: { ...value.schedule, days } });
  }

  const num =
    "w-20 rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40";

  return (
    <div className="rounded-xl border border-gray-200">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left"
      >
        {open ? <ChevronDown size={15} className="text-gray-400" /> : <ChevronRight size={15} className="text-gray-400" />}
        <ShieldCheck size={15} className="text-brand-600" />
        <span className="text-sm font-medium text-gray-800">Proteção antiban</span>
        {!windowOk && (
          <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-600">
            <AlertTriangle size={10} /> janela inválida
          </span>
        )}
        <span className="ml-auto text-[11px] text-gray-400">
          {value.min_interval_seconds}–{value.max_interval_seconds}s · {value.daily_limit}/dia · {value.hourly_limit}/h ·{" "}
          {value.schedule.start_time}–{value.schedule.end_time}
        </span>
      </button>

      {open && (
        <div className="space-y-4 border-t border-gray-100 p-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Intervalo entre envios (seg)</label>
              <div className="flex items-center gap-2">
                <input type="number" min={10} max={3600} value={value.min_interval_seconds} onChange={(e) => patch({ min_interval_seconds: Number(e.target.value) || 30 })} className={num} />
                <span className="text-xs text-gray-400">a</span>
                <input type="number" min={10} max={7200} value={value.max_interval_seconds} onChange={(e) => patch({ max_interval_seconds: Number(e.target.value) || 90 })} className={num} />
                <span className="text-[10px] text-gray-400">randômico</span>
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Limites da linha</label>
              <div className="flex items-center gap-2">
                <input type="number" min={1} max={1000} value={value.daily_limit} onChange={(e) => patch({ daily_limit: Number(e.target.value) || 200 })} className={num} />
                <span className="text-[10px] text-gray-400">/dia</span>
                <input type="number" min={1} max={200} value={value.hourly_limit} onChange={(e) => patch({ hourly_limit: Number(e.target.value) || 60 })} className={num} />
                <span className="text-[10px] text-gray-400">/hora</span>
              </div>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Janela de envio</label>
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex gap-1">
                {DAY_LABELS.map((l, d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => toggleDay(d)}
                    className={cn(
                      "h-7 w-7 rounded-full text-[11px] font-semibold",
                      value.schedule.days.includes(d)
                        ? "bg-brand-500 text-white"
                        : "bg-gray-100 text-gray-400 hover:bg-gray-200"
                    )}
                  >
                    {l}
                  </button>
                ))}
              </div>
              <input type="time" value={value.schedule.start_time} onChange={(e) => patch({ schedule: { ...value.schedule, start_time: e.target.value } })} className={cn("rounded-lg border px-2 py-1.5 text-sm", windowOk ? "border-gray-200" : "border-red-300")} />
              <span className="text-xs text-gray-400">às</span>
              <input type="time" value={value.schedule.end_time} onChange={(e) => patch({ schedule: { ...value.schedule, end_time: e.target.value } })} className={cn("rounded-lg border px-2 py-1.5 text-sm", windowOk ? "border-gray-200" : "border-red-300")} />
            </div>
            {!windowOk && (
              <p className="mt-1 flex items-center gap-1 text-[11px] text-red-600">
                <AlertTriangle size={11} />
                O horário final deve ser maior que o inicial e ao menos um dia precisa estar marcado — senão nada é enviado.
              </p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">
              Palavras de descadastro <span className="text-gray-400">(opt-out automático, separadas por vírgula)</span>
            </label>
            <input
              value={value.opt_out_keywords.join(", ")}
              onChange={(e) =>
                patch({ opt_out_keywords: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })
              }
              className="w-full rounded-lg border border-gray-200 px-2.5 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40"
            />
          </div>

          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-xs text-gray-600">
              <input type="checkbox" checked={value.simulate_typing} onChange={(e) => patch({ simulate_typing: e.target.checked })} className="accent-brand-500" />
              Simular digitação (2–6s) antes de cada envio
            </label>
            <label className="flex items-center gap-2 text-xs text-gray-600">
              <input type="checkbox" checked={value.skip_active_conversations} onChange={(e) => patch({ skip_active_conversations: e.target.checked })} className="accent-brand-500" />
              Pular contatos com conversa ativa (últimos 7 dias)
            </label>
          </div>

          {warmup && (
            <div className="flex items-center gap-2 rounded-lg bg-orange-50 px-3 py-2">
              <Flame size={14} className="text-orange-500" />
              <span className="text-xs text-orange-800">
                Warmup do número {warmup.enabled ? `ativo desde ${warmup.startDate ?? "hoje"} (rampa: 20→40→70→120/dia)` : "desligado"}
              </span>
              <button
                type="button"
                onClick={() => warmup.onToggle(!warmup.enabled)}
                className={cn(
                  "ml-auto rounded-lg px-2.5 py-1 text-[11px] font-medium",
                  warmup.enabled ? "bg-white text-orange-700 border border-orange-200" : "bg-orange-500 text-white"
                )}
              >
                {warmup.enabled ? "Desligar" : "Ativar warmup"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
