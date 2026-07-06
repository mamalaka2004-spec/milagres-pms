"use client";

import { useEffect, useState } from "react";
import {
  Coins,
  Loader2,
  AlertCircle,
  AlertTriangle,
  Plus,
  Check,
  CreditCard,
  Info,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import {
  AI_CREDIT_ENTRY_META,
  type AiCreditOverview,
  type AiCreditEntryType,
} from "@/types/ai-credits";

interface ApiResp<T> {
  success: boolean;
  data?: T;
  error?: string;
}
async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init);
  const json = (await res.json()) as ApiResp<T>;
  if (!json.success) throw new Error(json.error || `HTTP ${res.status}`);
  return json.data as T;
}

const numberFmt = new Intl.NumberFormat("pt-BR");

function entryChip(type: AiCreditEntryType) {
  const meta = AI_CREDIT_ENTRY_META[type];
  return (
    <span className={cn("text-[11px] font-semibold px-2 py-0.5 rounded-full", meta.tone)}>
      {meta.label}
    </span>
  );
}

function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AiCreditsShell({ canEdit }: { canEdit: boolean }) {
  const [data, setData] = useState<AiCreditOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [topupOpen, setTopupOpen] = useState(false);
  const [topupCredits, setTopupCredits] = useState("500");
  const [topupNote, setTopupNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  function load() {
    setLoading(true);
    api<AiCreditOverview>("/api/settings/ai-credits")
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function submitTopup(e: React.FormEvent) {
    e.preventDefault();
    if (!canEdit || saving) return;
    const credits = parseInt(topupCredits, 10);
    if (!Number.isFinite(credits) || credits <= 0) {
      setError("Informe um número de créditos válido.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const overview = await api<AiCreditOverview>("/api/settings/ai-credits/topup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credits, description: topupNote || undefined }),
      });
      setData(overview);
      setSavedAt(Date.now());
      setTopupOpen(false);
      setTopupNote("");
    } catch (e) {
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

  if (!data) {
    return (
      <div className="flex items-center gap-2 text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
        <AlertCircle size={15} /> {error || "Não foi possível carregar os créditos."}
      </div>
    );
  }

  const { account, usage_month, ledger, low_balance } = data;

  return (
    <div className="space-y-5 max-w-3xl">
      {error && (
        <div className="flex items-center gap-2 text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
          <AlertCircle size={15} /> {error}
        </div>
      )}

      {/* Balance card */}
      <div
        className={cn(
          "rounded-xl border p-5 transition-colors duration-200",
          low_balance ? "border-amber-300 bg-amber-50/60" : "border-brand-300 bg-brand-500/[0.04]"
        )}
      >
        <div className="flex items-start gap-4">
          <div
            className={cn(
              "w-11 h-11 rounded-xl flex items-center justify-center shrink-0",
              low_balance ? "bg-amber-500/15 text-amber-600" : "bg-brand-500/15 text-brand-600"
            )}
          >
            <Coins size={22} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-semibold text-gray-900">Saldo de créditos de IA</h2>
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 capitalize">
                Plano {account.plan}
              </span>
              {low_balance && (
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 inline-flex items-center gap-1">
                  <AlertTriangle size={11} /> Saldo baixo
                </span>
              )}
            </div>
            <div className="mt-2 text-3xl lg:text-4xl font-bold text-gray-900 tracking-tight tabular-nums">
              {numberFmt.format(account.balance_credits)}
              <span className="text-base font-medium text-gray-400 ml-1.5">créditos</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Franquia do plano: {numberFmt.format(account.monthly_included_credits)} créditos ·
              alerta em {numberFmt.format(account.low_balance_threshold)}. 1 crédito ≈ 1.000 tokens.
            </p>

            {canEdit && (
              <button
                onClick={() => setTopupOpen((v) => !v)}
                className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-brand-500 text-white font-semibold text-sm hover:bg-brand-600 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40"
              >
                <Plus size={15} /> Recarregar (manual)
              </button>
            )}
            {savedAt && (
              <p className="text-xs text-emerald-600 mt-2 inline-flex items-center gap-1">
                <Check size={13} /> Recarga aplicada
              </p>
            )}
          </div>
        </div>

        {/* Manual top-up form */}
        {topupOpen && canEdit && (
          <form
            onSubmit={submitTopup}
            className="mt-4 pt-4 border-t border-amber-200/60 flex flex-col sm:flex-row sm:items-end gap-3"
          >
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-600 mb-1">Créditos</label>
              <input
                type="number"
                min={1}
                step={1}
                value={topupCredits}
                onChange={(e) => setTopupCredits(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40"
              />
            </div>
            <div className="flex-[2]">
              <label className="block text-xs font-medium text-gray-600 mb-1">Nota (opcional)</label>
              <input
                type="text"
                value={topupNote}
                maxLength={200}
                placeholder="Ex.: recarga de teste"
                onChange={(e) => setTopupNote(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40"
              />
            </div>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-lg bg-gray-900 text-white font-semibold text-sm hover:bg-gray-800 transition-colors duration-200 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40 inline-flex items-center gap-1.5 justify-center"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              Adicionar
            </button>
          </form>
        )}
      </div>

      {/* Billing-pending callout */}
      <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-4 flex items-start gap-3">
        <CreditCard size={18} className="text-blue-600 shrink-0 mt-0.5" />
        <div className="text-sm text-blue-900">
          <p className="font-semibold">Cobrança automática ainda não configurada</p>
          <p className="text-blue-800/90 mt-0.5">
            O provedor de pagamento (Stripe, Asaas ou cobrança interna) é uma{" "}
            <strong>decisão pendente</strong>. Por enquanto, a recarga é <strong>manual</strong> e
            serve apenas para testar o consumo. Quando o gateway for definido, o crédito passará a
            ser lançado automaticamente após o pagamento confirmado.
          </p>
        </div>
      </div>

      {/* Usage this month */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="text-xs text-gray-500 font-medium">Consumo no mês</div>
          <div className="text-xl font-bold text-gray-900 mt-1 tabular-nums">
            {numberFmt.format(usage_month.consumption_credits)}
          </div>
          <div className="text-[11px] text-gray-400">créditos</div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="text-xs text-gray-500 font-medium">Tokens no mês</div>
          <div className="text-xl font-bold text-gray-900 mt-1 tabular-nums">
            {numberFmt.format(usage_month.consumption_tokens)}
          </div>
          <div className="text-[11px] text-gray-400">tokens de LLM</div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="text-xs text-gray-500 font-medium">Recargas no mês</div>
          <div className="text-xl font-bold text-gray-900 mt-1 tabular-nums">
            {numberFmt.format(usage_month.topup_credits)}
          </div>
          <div className="text-[11px] text-gray-400">créditos adicionados</div>
        </div>
      </div>

      {/* Ledger */}
      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
          <span className="font-semibold text-sm text-gray-900">Extrato de créditos</span>
          <span className="ml-auto text-[11px] text-gray-400">últimos {ledger.length}</span>
        </div>
        {ledger.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-gray-400 flex flex-col items-center gap-2">
            <Info size={18} className="text-gray-300" />
            Nenhuma movimentação ainda.
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {ledger.map((e) => (
              <div key={e.id} className="px-4 py-2.5 flex items-center gap-3">
                <div className="shrink-0">{entryChip(e.entry_type)}</div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm text-gray-800 truncate">
                    {e.description || e.source || "—"}
                  </div>
                  <div className="text-[11px] text-gray-400">
                    {fmtDateTime(e.created_at)}
                    {e.tokens_used ? ` · ${numberFmt.format(e.tokens_used)} tokens` : ""}
                  </div>
                </div>
                <div
                  className={cn(
                    "font-mono text-sm font-semibold shrink-0 tabular-nums",
                    e.credits >= 0 ? "text-emerald-600" : "text-rose-600"
                  )}
                >
                  {e.credits >= 0 ? "+" : ""}
                  {numberFmt.format(e.credits)}
                </div>
                <div className="w-20 text-right text-[11px] text-gray-400 shrink-0 tabular-nums hidden sm:block">
                  {numberFmt.format(e.balance_after)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {!canEdit && (
        <p className="text-xs text-gray-400">
          Somente administradores podem recarregar créditos.
        </p>
      )}
    </div>
  );
}
