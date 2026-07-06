"use client";

import Link from "next/link";
import {
  BedDouble,
  DollarSign,
  CalendarDays,
  CreditCard,
  Star,
  Wallet,
  TrendingUp,
  Target,
  Trophy,
  Percent,
  Briefcase,
} from "lucide-react";
import { StatsCard } from "@/components/dashboard/stats-card";
import { useMode } from "@/lib/mode";
import {
  formatCurrency,
  formatCurrencyShort,
  getInitials,
} from "@/lib/utils/format";
import {
  ReservationStatusBadge,
  PaymentStatusBadge,
} from "@/components/shared/status-badges";
import type { DashboardData } from "@/lib/db/queries/dashboard";

const CHANNEL_LABELS: Record<string, string> = {
  direct: "Direto",
  airbnb: "Airbnb",
  booking: "Booking",
  expedia: "Expedia",
  vrbo: "VRBO",
  manual: "Manual",
  other: "Outro",
};

function StatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = {
    confirmed: "bg-green-500",
    pending: "bg-amber-500",
    in_progress: "bg-blue-500",
    completed: "bg-green-500",
    checked_in: "bg-blue-500",
  };
  return (
    <span className={`inline-block w-2 h-2 rounded-full ${colors[status] || "bg-gray-400"}`} />
  );
}

function CardShell({
  title,
  icon,
  badge,
  action,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
        {icon}
        <span className="font-semibold text-sm text-gray-900">{title}</span>
        {badge}
        {action && <div className="ml-auto">{action}</div>}
      </div>
      {children}
    </div>
  );
}

function MiniStat({
  label,
  value,
  tone = "default",
  hint,
}: {
  label: string;
  value: string;
  tone?: "default" | "positive" | "negative" | "warning";
  hint?: string;
}) {
  const toneCls =
    tone === "positive"
      ? "text-emerald-600"
      : tone === "negative"
      ? "text-rose-600"
      : tone === "warning"
      ? "text-amber-600"
      : "text-gray-900";
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
      <div className="text-[11px] lg:text-xs text-gray-500 font-medium">{label}</div>
      <div className={`text-lg lg:text-xl font-bold mt-1 tracking-tight tabular-nums ${toneCls}`}>
        {value}
      </div>
      {hint && <div className="text-[10px] text-gray-400 mt-0.5">{hint}</div>}
    </div>
  );
}

function CashflowBars({ months }: { months: DashboardData["finance"]["months"] }) {
  if (!months.length) {
    return <div className="px-4 py-8 text-center text-sm text-gray-400">Sem dados de fluxo de caixa.</div>;
  }
  const max = Math.max(
    1,
    ...months.map((m) => Math.max(m.revenue_cents, m.expense_cents))
  );
  return (
    <div className="px-4 py-4">
      <div className="flex items-end justify-between gap-2 h-32">
        {months.map((m) => {
          const revH = Math.round((m.revenue_cents / max) * 100);
          const expH = Math.round((m.expense_cents / max) * 100);
          const label = m.month.slice(5); // MM
          return (
            <div key={m.month} className="flex-1 flex flex-col items-center gap-1 min-w-0">
              <div className="flex items-end gap-0.5 h-24 w-full justify-center">
                <div
                  className="w-2.5 lg:w-3 rounded-t bg-emerald-400/80"
                  style={{ height: `${Math.max(2, revH)}%` }}
                  title={`Receita ${formatCurrencyShort(m.revenue_cents)}`}
                />
                <div
                  className="w-2.5 lg:w-3 rounded-t bg-rose-300"
                  style={{ height: `${Math.max(2, expH)}%` }}
                  title={`Despesa ${formatCurrencyShort(m.expense_cents)}`}
                />
              </div>
              <span className="text-[10px] text-gray-400">{label}</span>
            </div>
          );
        })}
      </div>
      <div className="flex items-center gap-4 mt-3 justify-center">
        <span className="inline-flex items-center gap-1 text-[11px] text-gray-500">
          <span className="w-2.5 h-2.5 rounded-sm bg-emerald-400/80" /> Receita
        </span>
        <span className="inline-flex items-center gap-1 text-[11px] text-gray-500">
          <span className="w-2.5 h-2.5 rounded-sm bg-rose-300" /> Despesa
        </span>
      </div>
    </div>
  );
}

function FinanceStrip({ finance }: { finance: DashboardData["finance"] }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
      <MiniStat label="Saldo em contas" value={formatCurrencyShort(finance.total_balance_cents)} hint="Todas as contas" />
      <MiniStat
        label="Receita paga (mês)"
        value={formatCurrencyShort(finance.revenue_month_cents)}
        tone="positive"
      />
      <MiniStat
        label="Despesa (mês)"
        value={formatCurrencyShort(finance.expense_month_cents)}
        tone="negative"
      />
      <MiniStat
        label="Resultado (mês)"
        value={formatCurrencyShort(finance.net_month_cents)}
        tone={finance.net_month_cents >= 0 ? "positive" : "negative"}
      />
    </div>
  );
}

// ─── Locação ────────────────────────────────────────────────────────────────
function LocacaoView({ data }: { data: DashboardData }) {
  const s = data.stats;
  const occupancyValue = `${(s.occupancy_rate * 100).toFixed(0)}%`;
  const occupancySub = `${s.occupied_units} de ${s.active_units} unidades`;
  const revenueValue = formatCurrencyShort(s.monthly_revenue_cents);
  const revenueTrend =
    s.monthly_revenue_change_pct === 0
      ? null
      : `${s.monthly_revenue_change_pct > 0 ? "+" : ""}${s.monthly_revenue_change_pct.toFixed(0)}%`;

  return (
    <>
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        <StatsCard label="Ocupação" value={occupancyValue} subtitle={occupancySub} icon={BedDouble} />
        <StatsCard
          label="Receita"
          value={revenueValue}
          subtitle="Reservas do mês"
          icon={DollarSign}
          trend={revenueTrend ?? undefined}
          trendUp={s.monthly_revenue_change_pct >= 0}
        />
        <StatsCard label="Reservas" value={String(s.reservations_this_month)} subtitle="Este mês" icon={CalendarDays} />
        <StatsCard
          label="A receber"
          value={formatCurrencyShort(s.pending_amount_cents)}
          subtitle={`${s.pending_count} não pago`}
          icon={CreditCard}
        />
      </div>

      {/* Operational quick counts */}
      <div className="grid grid-cols-3 gap-3 lg:gap-4">
        <MiniStat label="Tarefas pendentes" value={String(data.tasks.pending)} hint="Operação" />
        <MiniStat
          label="Atrasadas"
          value={String(data.tasks.overdue)}
          tone={data.tasks.overdue > 0 ? "warning" : "default"}
        />
        <MiniStat label="Para hoje" value={String(data.tasks.today)} />
      </div>

      {/* Today's Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 lg:gap-4">
        <CardShell
          title="Check-ins hoje"
          icon={<span className="text-brand-500" aria-hidden="true">✈️</span>}
          badge={
            <span className="ml-auto bg-brand-100 text-brand-600 px-2 py-0.5 rounded-full text-[11px] font-bold">
              {data.today_checkins.length}
            </span>
          }
        >
          {data.today_checkins.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-gray-400">Nenhum check-in hoje.</div>
          ) : (
            data.today_checkins.map((ci) => (
              <Link
                key={ci.id}
                href={`/reservations/${ci.id}`}
                className="px-4 py-3 border-b border-gray-50 flex items-center gap-3 hover:bg-gray-50 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40"
              >
                <div className="w-9 h-9 rounded-full bg-brand-50 flex items-center justify-center text-brand-600 font-bold text-xs shrink-0">
                  {getInitials(ci.guest_name)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm text-gray-900 truncate inline-flex items-center gap-1">
                    {ci.guest_name}
                    {ci.is_vip && <Star size={11} className="text-amber-500" fill="currentColor" aria-hidden="true" />}
                  </div>
                  <div className="text-xs text-gray-400">
                    {ci.property_name} · {ci.nights}n · {ci.booking_code}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <StatusDot status={ci.status} />
                  <span className="text-[10px] text-gray-400 capitalize">{ci.status.replace("_", " ")}</span>
                </div>
              </Link>
            ))
          )}
        </CardShell>

        <CardShell
          title="Check-outs hoje"
          icon={<span className="text-amber-500" aria-hidden="true">🛫</span>}
          badge={
            <span className="ml-auto bg-amber-50 text-amber-600 px-2 py-0.5 rounded-full text-[11px] font-bold">
              {data.today_checkouts.length}
            </span>
          }
        >
          {data.today_checkouts.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-gray-400">Nenhum check-out hoje.</div>
          ) : (
            data.today_checkouts.map((co) => (
              <Link
                key={co.id}
                href={`/reservations/${co.id}`}
                className="px-4 py-3 border-b border-gray-50 flex items-center gap-3 hover:bg-gray-50 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40"
              >
                <div className="w-9 h-9 rounded-full bg-amber-50 flex items-center justify-center text-amber-700 font-bold text-xs shrink-0">
                  {getInitials(co.guest_name)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm text-gray-900 truncate">{co.guest_name}</div>
                  <div className="text-xs text-gray-400">
                    {co.property_name} · {co.booking_code}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <StatusDot status={co.cleaning_status || "pending"} />
                  <span className="text-[10px] text-gray-400 capitalize">
                    {co.cleaning_status ? co.cleaning_status.replace("_", " ") : "sem tarefa"}
                  </span>
                </div>
              </Link>
            ))
          )}
        </CardShell>
      </div>

      {/* Finance strip + cashflow + channels */}
      <FinanceStrip finance={data.finance} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 lg:gap-4">
        <CardShell title="Fluxo de caixa (6 meses)" icon={<Wallet size={15} className="text-gray-400" />}>
          <CashflowBars months={data.finance.months} />
        </CardShell>

        <CardShell title="Reservas por canal (mês)" icon={<TrendingUp size={15} className="text-gray-400" />}>
          {data.channels.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-gray-400">Sem reservas no mês.</div>
          ) : (
            <div className="p-4 space-y-2.5">
              {data.channels.map((c) => {
                const max = data.channels[0].amount_cents || 1;
                const pct = Math.round((c.amount_cents / max) * 100);
                return (
                  <div key={c.channel}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-medium text-gray-700">
                        {CHANNEL_LABELS[c.channel] || c.channel}
                        <span className="text-gray-400 font-normal"> · {c.count}</span>
                      </span>
                      <span className="font-mono text-gray-600">{formatCurrencyShort(c.amount_cents)}</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-brand-400 rounded-full" style={{ width: `${Math.max(3, pct)}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardShell>
      </div>

      {/* Recent reservations */}
      {data.recent_reservations.length > 0 && (
        <CardShell
          title="Reservas recentes"
          action={
            <Link href="/reservations" className="text-xs font-semibold text-brand-600 hover:text-brand-700 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40 rounded">
              Ver todas →
            </Link>
          }
        >
          <div className="divide-y divide-gray-100">
            {data.recent_reservations.map((r) => (
              <Link
                key={r.id}
                href={`/reservations/${r.id}`}
                className="px-4 py-3 flex justify-between items-center gap-3 hover:bg-gray-50 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40"
              >
                <div className="min-w-0">
                  <div className="font-mono text-xs text-gray-500">{r.booking_code}</div>
                  <div className="font-semibold text-sm text-gray-900 truncate">{r.guest_name}</div>
                  <div className="text-xs text-gray-500">{r.property_name}</div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 flex-wrap justify-end">
                  <span className="font-mono text-sm font-semibold text-gray-900">{formatCurrency(r.total_cents)}</span>
                  <ReservationStatusBadge status={r.status as Parameters<typeof ReservationStatusBadge>[0]["status"]} />
                  <PaymentStatusBadge status={r.payment_status as Parameters<typeof PaymentStatusBadge>[0]["status"]} />
                </div>
              </Link>
            ))}
          </div>
        </CardShell>
      )}

      {/* Quick Actions */}
      <div className="hidden lg:flex gap-3">
        <Link
          href="/reservations/new"
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg border border-brand-400 text-brand-600 font-semibold text-sm hover:bg-brand-50 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40"
        >
          + Nova Reserva
        </Link>
        <Link
          href="/calendar"
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg border border-gray-200 text-gray-600 font-semibold text-sm hover:bg-gray-50 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40"
        >
          Ver Agenda
        </Link>
        <Link
          href="/finance"
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg border border-gray-200 text-gray-600 font-semibold text-sm hover:bg-gray-50 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40"
        >
          Financeiro
        </Link>
      </div>
    </>
  );
}

// ─── Vendas ─────────────────────────────────────────────────────────────────
function VendasView({ data }: { data: DashboardData }) {
  const f = data.funnel;
  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        <StatsCard label="Negócios abertos" value={String(f.open_count)} subtitle="No funil de vendas" icon={Briefcase} />
        <StatsCard label="Valor em aberto" value={formatCurrencyShort(f.open_value_cents)} subtitle="Pipeline ativo" icon={Target} />
        <StatsCard
          label="Ganhos (mês)"
          value={formatCurrencyShort(f.won_month_value_cents)}
          subtitle={`${f.won_month_count} negócio(s)`}
          icon={Trophy}
        />
        <StatsCard label="Conversão (mês)" value={`${f.conversion_pct.toFixed(0)}%`} subtitle={`${f.lost_month_count} perdido(s)`} icon={Percent} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 lg:gap-4">
        <CardShell title="Funil por etapa" icon={<Target size={15} className="text-gray-400" />}>
          {f.by_stage.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-gray-400">
              Nenhuma etapa de vendas configurada.
            </div>
          ) : (
            <div className="p-4 space-y-2.5">
              {f.by_stage.map((st) => {
                const max = Math.max(1, ...f.by_stage.map((x) => x.value_cents), 1);
                const pct = Math.round((st.value_cents / max) * 100);
                return (
                  <div key={st.stage_id}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-medium text-gray-700 inline-flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: st.color || "#9ca3af" }} />
                        {st.name}
                        <span className="text-gray-400 font-normal"> · {st.count}</span>
                      </span>
                      <span className="font-mono text-gray-600">{formatCurrencyShort(st.value_cents)}</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${Math.max(3, pct)}%`, backgroundColor: st.color || "#7c9a80" }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardShell>

        <CardShell
          title="Negócios recentes"
          icon={<Briefcase size={15} className="text-gray-400" />}
          action={
            <Link href="/vendas" className="text-xs font-semibold text-brand-600 hover:text-brand-700 transition-colors duration-200 rounded">
              Ver funil →
            </Link>
          }
        >
          {f.recent_deals.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-gray-400">Nenhum negócio ainda.</div>
          ) : (
            <div className="divide-y divide-gray-50">
              {f.recent_deals.map((d) => (
                <div key={d.id} className="px-4 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-semibold text-sm text-gray-900 truncate">{d.title}</div>
                    <div className="text-xs text-gray-400">{d.stage_name || "Sem etapa"}</div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-mono text-sm font-semibold text-gray-900">{formatCurrency(d.value_cents)}</span>
                    <span
                      className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                        d.status === "won"
                          ? "bg-emerald-50 text-emerald-700"
                          : d.status === "lost"
                          ? "bg-rose-50 text-rose-600"
                          : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {d.status === "won" ? "Ganho" : d.status === "lost" ? "Perdido" : "Aberto"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardShell>
      </div>

      {/* Finance strip shared */}
      <FinanceStrip finance={data.finance} />

      <CardShell title="Fluxo de caixa (6 meses)" icon={<Wallet size={15} className="text-gray-400" />}>
        <CashflowBars months={data.finance.months} />
      </CardShell>

      {/* Quick Actions */}
      <div className="hidden lg:flex gap-3">
        <Link
          href="/vendas"
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg border border-brand-400 text-brand-600 font-semibold text-sm hover:bg-brand-50 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40"
        >
          Funil de Vendas
        </Link>
        <Link
          href="/properties"
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg border border-gray-200 text-gray-600 font-semibold text-sm hover:bg-gray-50 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40"
        >
          Imóveis
        </Link>
        <Link
          href="/finance"
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg border border-gray-200 text-gray-600 font-semibold text-sm hover:bg-gray-50 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40"
        >
          Financeiro
        </Link>
      </div>
    </>
  );
}

export function DashboardView({ data }: { data: DashboardData }) {
  const { isVendas } = useMode();
  return (
    <div className="space-y-4 lg:space-y-6">
      {isVendas ? <VendasView data={data} /> : <LocacaoView data={data} />}
    </div>
  );
}
