"use client";

// ===========================================================================
// Fluxo de Caixa — saldos por conta, pendências e realizado por mês.
// Cores das séries validadas (CVD/contraste): Entradas #62994A · Saídas #9C4B2F;
// Resultado em tinta neutra (série derivada). Tabela mensal = table view.
// ===========================================================================

import { useEffect, useMemo, useState } from "react";
import { Loader2, PiggyBank, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import {
  Bar,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { cn } from "@/lib/utils/cn";
import { api } from "@/lib/chat/utils";
import { toast } from "@/components/ui/use-toast";
import { formatCurrency } from "@/lib/utils/format";
import { BANK_ACCOUNT_TYPE_LABELS, type CashFlowReport } from "@/types/finance";

const REVENUE_COLOR = "#62994A";
const EXPENSE_COLOR = "#9C4B2F";
const NET_COLOR = "#374151";

const MONTH_SHORT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

function monthLabel(yyyymm: string) {
  const m = parseInt(yyyymm.slice(5, 7), 10);
  return `${MONTH_SHORT[m - 1] || "?"}/${yyyymm.slice(2, 4)}`;
}

function fmtBRL(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(value / 100);
}

interface CashFlowTabProps {
  /** Mudou = alguma mutação aconteceu; recarrega o relatório. */
  reloadKey: number;
}

export function CashFlowTab({ reloadKey }: CashFlowTabProps) {
  const [months, setMonths] = useState(12);
  const [report, setReport] = useState<CashFlowReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    api<CashFlowReport>(`/api/finance/cashflow?months=${months}`)
      .then((r) => {
        if (alive) setReport(r);
      })
      .catch(() => toast({ title: "Erro ao carregar fluxo de caixa", variant: "error" }))
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [months, reloadKey]);

  const currentMonth = useMemo(() => {
    if (!report) return null;
    const key = new Date().toISOString().slice(0, 7);
    return report.months.find((m) => m.month === key) ?? null;
  }, [report]);

  const chartData = useMemo(
    () =>
      (report?.months ?? []).map((m) => ({
        name: monthLabel(m.month),
        Entradas: m.revenue_cents,
        Saídas: m.expense_cents,
        Resultado: m.net_cents,
      })),
    [report]
  );

  if (loading && !report) {
    return (
      <div className="flex items-center justify-center py-16 text-gray-400">
        <Loader2 className="animate-spin" size={20} aria-hidden="true" />
      </div>
    );
  }
  if (!report) return null;

  const hasData = report.months.some((m) => m.revenue_cents > 0 || m.expense_cents > 0);

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          icon={PiggyBank}
          label="Saldo em contas"
          value={formatCurrency(report.total_balance_cents)}
          valueClass={report.total_balance_cents < 0 ? "text-red-700" : "text-gray-900"}
          subtitle={`${report.balances.length} conta(s)`}
        />
        <StatCard
          icon={TrendingUp}
          label="A receber"
          value={formatCurrency(report.pending_in_cents)}
          valueClass="text-green-700"
          subtitle={
            report.overdue_in_cents > 0
              ? `${formatCurrency(report.overdue_in_cents)} vencido`
              : "Nada vencido"
          }
        />
        <StatCard
          icon={TrendingDown}
          label="A pagar"
          value={formatCurrency(report.pending_out_cents)}
          valueClass="text-red-700"
          subtitle={
            report.overdue_out_cents > 0
              ? `${formatCurrency(report.overdue_out_cents)} vencido`
              : "Nada vencido"
          }
        />
        <StatCard
          icon={Wallet}
          label="Resultado do mês"
          value={formatCurrency(currentMonth?.net_cents ?? 0)}
          valueClass={(currentMonth?.net_cents ?? 0) < 0 ? "text-red-700" : "text-green-700"}
          subtitle="Entradas − saídas pagas"
        />
      </div>

      {/* Saldos por conta */}
      {report.balances.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/60 py-8 text-center text-sm text-gray-400">
          Nenhuma conta bancária cadastrada. Crie as contas na aba <strong>Cadastros</strong> para
          acompanhar os saldos.
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {report.balances.map((acc) => (
            <div
              key={acc.id}
              className={cn(
                "bg-white rounded-xl border border-gray-200 shadow-sm p-4",
                !acc.is_active && "opacity-60"
              )}
            >
              <div className="text-sm font-semibold text-gray-900 truncate">{acc.name}</div>
              <div className="text-[11px] text-gray-500">
                {BANK_ACCOUNT_TYPE_LABELS[acc.type]}
                {!acc.is_active && " · inativa"}
              </div>
              <div
                className={cn(
                  "mt-2 font-mono text-lg font-bold",
                  acc.current_balance_cents < 0 ? "text-red-700" : "text-gray-900"
                )}
              >
                {formatCurrency(acc.current_balance_cents)}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Gráfico */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 lg:p-6">
        <div className="flex items-center justify-between gap-3 mb-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400">
            Fluxo de caixa realizado (pagas)
          </h2>
          <select
            value={months}
            onChange={(e) => setMonths(Number(e.target.value))}
            className="px-2 py-1 rounded-lg border border-gray-200 text-xs bg-white cursor-pointer"
            aria-label="Período do fluxo de caixa"
          >
            <option value={6}>6 meses</option>
            <option value={12}>12 meses</option>
            <option value={24}>24 meses</option>
          </select>
        </div>
        {!hasData ? (
          <div className="h-56 flex items-center justify-center text-sm text-gray-400">
            Sem transações pagas no período.
          </div>
        ) : (
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                <YAxis
                  tick={{ fontSize: 11 }}
                  stroke="#94a3b8"
                  tickFormatter={(v: number) => `R$${Math.round(v / 100000)}k`}
                />
                <Tooltip
                  formatter={(value: number) => fmtBRL(value)}
                  labelStyle={{ color: "#1f2937", fontWeight: 600 }}
                  contentStyle={{ borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 12 }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="Entradas" fill={REVENUE_COLOR} radius={[4, 4, 0, 0]} maxBarSize={28} />
                <Bar dataKey="Saídas" fill={EXPENSE_COLOR} radius={[4, 4, 0, 0]} maxBarSize={28} />
                <Line
                  type="monotone"
                  dataKey="Resultado"
                  stroke={NET_COLOR}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Tabela mensal */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100">
          <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400">Por mês</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr className="text-left text-[11px] uppercase tracking-wider text-gray-500">
                <th className="px-4 py-2 font-semibold">Mês</th>
                <th className="px-4 py-2 font-semibold text-right">Entradas</th>
                <th className="px-4 py-2 font-semibold text-right">Saídas</th>
                <th className="px-4 py-2 font-semibold text-right">Resultado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {report.months.map((m) => (
                <tr key={m.month} className="hover:bg-gray-50 transition-colors duration-200">
                  <td className="px-4 py-2 text-gray-700 font-medium">{monthLabel(m.month)}</td>
                  <td className="px-4 py-2 text-right font-mono text-green-700">
                    {formatCurrency(m.revenue_cents)}
                  </td>
                  <td className="px-4 py-2 text-right font-mono text-red-700">
                    {formatCurrency(m.expense_cents)}
                  </td>
                  <td
                    className={cn(
                      "px-4 py-2 text-right font-mono font-semibold",
                      m.net_cents < 0 ? "text-red-700" : "text-gray-900"
                    )}
                  >
                    {formatCurrency(m.net_cents)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  valueClass,
  subtitle,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  valueClass?: string;
  subtitle?: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
      <div className="flex items-center gap-2 text-gray-400 mb-1">
        <Icon size={14} aria-hidden="true" />
        <span className="text-[11px] font-semibold uppercase tracking-wider">{label}</span>
      </div>
      <div className={cn("text-xl lg:text-2xl font-bold font-mono", valueClass || "text-gray-900")}>
        {value}
      </div>
      {subtitle && <div className="text-[11px] text-gray-500 mt-0.5">{subtitle}</div>}
    </div>
  );
}
