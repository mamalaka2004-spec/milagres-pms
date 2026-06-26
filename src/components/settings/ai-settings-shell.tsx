"use client";

import { useEffect, useState } from "react";
import { Bot, BotOff, Loader2, AlertCircle, Check, MessageSquare, Layers } from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface LineSummary {
  id: string;
  label: string;
  phone: string;
  ai_enabled: boolean;
  is_active: boolean;
}
interface AiSettings {
  ai_enabled: boolean;
  lines: LineSummary[];
}

interface ApiResp<T> { success: boolean; data?: T; error?: string }
async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init);
  const json = (await res.json()) as ApiResp<T>;
  if (!json.success) throw new Error(json.error || `HTTP ${res.status}`);
  return json.data as T;
}

export default function AiSettingsShell({ canEdit }: { canEdit: boolean }) {
  const [data, setData] = useState<AiSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    api<AiSettings>("/api/settings/ai")
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, []);

  async function toggleMaster() {
    if (!data || !canEdit || saving) return;
    const next = !data.ai_enabled;
    setSaving(true);
    setError(null);
    // optimistic
    setData({ ...data, ai_enabled: next });
    try {
      await api("/api/settings/ai", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ai_enabled: next }),
      });
      setSavedAt(Date.now());
    } catch (e) {
      setData({ ...data, ai_enabled: !next }); // revert
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-500 py-10">
        <Loader2 className="animate-spin" size={16} /> Carregando…
      </div>
    );
  }

  const master = data?.ai_enabled === true;

  return (
    <div className="space-y-5 max-w-2xl">
      {error && (
        <div className="flex items-center gap-2 text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
          <AlertCircle size={15} /> {error}
        </div>
      )}

      {/* Master switch */}
      <div className={cn(
        "rounded-xl border p-5 transition-colors duration-200",
        master ? "border-brand-300 bg-brand-500/[0.04]" : "border-gray-200 bg-white",
      )}>
        <div className="flex items-start gap-4">
          <div className={cn(
            "w-11 h-11 rounded-xl flex items-center justify-center shrink-0 transition-colors duration-200",
            master ? "bg-brand-500/15 text-brand-600" : "bg-gray-100 text-gray-400",
          )}>
            {master ? <Bot size={22} /> : <BotOff size={22} />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="font-semibold text-gray-900">Inteligência Artificial</h2>
              <span className={cn(
                "text-[11px] font-semibold px-2 py-0.5 rounded-full",
                master ? "bg-brand-500/10 text-brand-700" : "bg-gray-100 text-gray-500",
              )}>
                {master ? "Ligada" : "Desligada"}
              </span>
            </div>
            <p className="text-sm text-gray-500 mt-1">
              Chave-mestra do sistema. Quando <strong>desligada</strong>, a IA não responde
              automaticamente em <strong>nenhuma</strong> linha ou conversa — mesmo que estejam
              ativadas individualmente. Quando <strong>ligada</strong>, valem as ativações de cada
              linha e de cada conversa.
            </p>

            <button
              onClick={toggleMaster}
              disabled={!canEdit || saving}
              role="switch"
              aria-checked={master}
              aria-label="Ativar inteligência artificial do sistema"
              className={cn(
                "mt-4 relative inline-flex h-7 w-12 items-center rounded-full transition-colors duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40",
                master ? "bg-brand-500" : "bg-gray-300",
                (!canEdit || saving) && "opacity-60 cursor-not-allowed",
              )}
            >
              <span className={cn(
                "inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform duration-200",
                master ? "translate-x-6" : "translate-x-1",
              )} />
            </button>
            {!canEdit && (
              <p className="text-xs text-gray-400 mt-2">Somente administradores podem alterar esta configuração.</p>
            )}
            {savedAt && canEdit && (
              <p className="text-xs text-emerald-600 mt-2 inline-flex items-center gap-1">
                <Check size={13} /> Salvo
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Hierarchy explainer */}
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <div className="flex items-center gap-2 mb-3">
          <Layers size={16} className="text-gray-400" />
          <h3 className="font-semibold text-sm text-gray-900">Hierarquia de ativação</h3>
        </div>
        <ol className="space-y-2 text-sm">
          <li className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-brand-500/10 text-brand-700 text-[11px] font-bold flex items-center justify-center shrink-0">1</span>
            <span className="text-gray-700"><strong>Sistema</strong> (esta tela) — chave-mestra acima de tudo.</span>
          </li>
          <li className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-gray-100 text-gray-600 text-[11px] font-bold flex items-center justify-center shrink-0">2</span>
            <span className="text-gray-700"><strong>Linha</strong> — cada número (Reservas, Vendas) liga/desliga a IA em Ajustes → Linhas WhatsApp.</span>
          </li>
          <li className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-gray-100 text-gray-600 text-[11px] font-bold flex items-center justify-center shrink-0">3</span>
            <span className="text-gray-700"><strong>Conversa</strong> — dentro do chat, pausa/retoma a IA por conversa.</span>
          </li>
        </ol>

        {/* Per-line state */}
        {data && data.lines.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-100 space-y-2">
            {data.lines.map((l) => {
              const effective = master && l.ai_enabled && l.is_active;
              return (
                <div key={l.id} className="flex items-center justify-between gap-3 text-sm">
                  <div className="flex items-center gap-2 min-w-0">
                    <MessageSquare size={14} className="text-gray-400 shrink-0" />
                    <span className="font-medium text-gray-800 truncate">{l.label}</span>
                    <span className="text-gray-400 truncate">{l.phone}</span>
                  </div>
                  <span className={cn(
                    "text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0",
                    effective ? "bg-emerald-50 text-emerald-700"
                      : l.ai_enabled ? "bg-amber-50 text-amber-700"
                      : "bg-gray-100 text-gray-500",
                  )}>
                    {effective ? "IA ativa" : !master ? "Bloqueada pelo sistema" : l.ai_enabled ? "Linha ativa" : "Linha desligada"}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
