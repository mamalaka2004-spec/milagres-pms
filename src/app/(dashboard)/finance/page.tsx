import Link from "next/link";
import { DollarSign, TrendingUp, BedDouble, CreditCard } from "lucide-react";
import { requireAuth } from "@/lib/auth";
import { getFinanceSummary } from "@/lib/db/queries/finance";
import { listPaymentsForCompany } from "@/lib/db/queries/payments";
import { formatCurrency, formatDate } from "@/lib/utils/format";
import { CHANNELS } from "@/lib/utils/constants";
import { RevenueChart } from "@/components/finance/revenue-chart";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ from?: string; to?: string }>;
}

function defaultRange() {
  const today = new Date();
  const from = new Date(today.getFullYear(), today.getMonth() - 5, 1)
    .toISOString()
    .slice(0, 10);
  const to = new Date(today.getFullYear(), today.getMonth() + 1, 0)
    .toISOString()
    .slice(0, 10);
  return { from, to };
}

export default async function FinancePage({ searchParams }: PageProps) {
  const user = await requireAuth();
  const params = await searchParams;
  const range = {
    from: params.from || defaultRange().from,
    to: params.to || defaultRange().to,
  };

  const [summary, paymentsRaw] = await Promise.all([
    getFinanceSummary(user.company_id, range.from, range.to),
    listPaymentsForCompany(user.company_id, { from: range.from, to: range.to }),
  ]);

  const payments = (paymentsRaw as unknown as Array<{
    id: string;
    amount_cents: number;
    method: string;
    status: string;
    reference: string | null;
    paid_at: string | null;
    created_at: string;
    reservation: { id: string; booking_code: string; guest: { full_name: string } | null; property: { id: string; name: string; code: string } | null } | null;
  }>) || [];

  return (
    <div className="space-y-4 lg:space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-gray-900">Finance</h1>
          <p className="text-xs text-gray-500">
            {formatDate(range.from)} → {formatDate(range.to)}
          </p>
        </div>
        <form className="flex gap-2 items-center" action="/finance" method="GET">
          <input
            type="date"
            name="from"
            defaultValue={range.from}
            className="px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white"
          />
          <span className="text-gray-400 text-sm">→</span>
          <input
            type="date"
            name="to"
            defaultValue={range.to}
            className="px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white"
          />
          <button
            type="submit"
            className="px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-sm font-semibold text-gray-700"
          >
            Apply
          </button>
        </form>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat
          icon={DollarSign}
          label="Gross revenue"
          value={formatCurrency(summary.gross_revenue_cents)}
          tone="positive"
        />
        <Stat
          icon={TrendingUp}
          label="Net revenue"
          value={formatCurrency(summary.net_cents)}
          subtitle={`After fees & expenses`}
        />
        <Stat
          icon={BedDouble}
          label="Occupancy"
          value={`${(summary.occupancy_rate * 100).toFixed(0)}%`}
          subtitle={`${summary.reservations_count} reservas no período`}
        />
        <Stat
          icon={CreditCard}
          label="Payments"
          value={String(payments.length)}
          subtitle={`${payments.filter((p) => p.status === "completed").length} completed`}
        />
      </div>

      {/* Revenue chart */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 lg:p-6">
        <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">
          Revenue by month
        </h2>
        <RevenueChart data={summary.monthly} />
      </div>

      {/* By channel + by property */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">
            By channel
          </h2>
          {summary.by_channel.length === 0 ? (
            <div className="text-sm text-gray-400 py-4">No data.</div>
          ) : (
            <div className="space-y-2">
              {summary.by_channel.map((c) => {
                const pct = summary.gross_revenue_cents > 0
                  ? (c.amount_cents / summary.gross_revenue_cents) * 100
                  : 0;
                const cfg = CHANNELS[c.channel as keyof typeof CHANNELS];
                return (
                  <div key={c.channel} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="font-semibold" style={{ color: cfg?.color || "#666" }}>
                        {cfg?.label || c.channel}
                      </span>
                      <span className="font-mono text-gray-700">
                        {formatCurrency(c.amount_cents)} · {c.count} ×
                      </span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded overflow-hidden">
                      <div
                        className="h-full rounded transition-all"
                        style={{
                          width: `${pct}%`,
                          backgroundColor: cfg?.color || "#94a3b8",
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">
            By property
          </h2>
          {summary.by_property.length === 0 ? (
            <div className="text-sm text-gray-400 py-4">No data.</div>
          ) : (
            <div className="space-y-2">
              {summary.by_property.slice(0, 6).map((p) => {
                const pct = summary.gross_revenue_cents > 0
                  ? (p.amount_cents / summary.gross_revenue_cents) * 100
                  : 0;
                return (
                  <div key={p.property_id} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <Link
                        href={`/properties/${p.property_id}`}
                        className="font-semibold text-gray-700 hover:text-brand-600 truncate"
                      >
                        {p.name}
                      </Link>
                      <span className="font-mono text-gray-700">
                        {formatCurrency(p.amount_cents)} · {p.count} ×
                      </span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded overflow-hidden">
                      <div
                        className="h-full bg-brand-500 rounded transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Recent payments */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 flex justify-between items-center">
          <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400">
            Payments ({payments.length})
          </h2>
        </div>
        {payments.length === 0 ? (
          <div className="px-5 py-12 text-center text-sm text-gray-400">
            No payments in this period.
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-2 text-left text-[11px] font-semibold text-gray-500 uppercase">
                  Date
                </th>
                <th className="px-4 py-2 text-left text-[11px] font-semibold text-gray-500 uppercase">
                  Reservation
                </th>
                <th className="px-4 py-2 text-left text-[11px] font-semibold text-gray-500 uppercase hidden md:table-cell">
                  Method
                </th>
                <th className="px-4 py-2 text-right text-[11px] font-semibold text-gray-500 uppercase">
                  Amount
                </th>
                <th className="px-4 py-2 text-left text-[11px] font-semibold text-gray-500 uppercase">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {payments.slice(0, 30).map((p) => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 text-xs text-gray-600 font-mono">
                    {p.paid_at ? formatDate(p.paid_at, "dd/MM HH:mm") : "—"}
                  </td>
                  <td className="px-4 py-2 text-sm">
                    {p.reservation ? (
                      <Link
                        href={`/reservations/${p.reservation.id}`}
                        className="font-mono text-xs font-semibold text-brand-700 hover:text-brand-800"
                      >
                        {p.reservation.booking_code}
                      </Link>
                    ) : (
                      "—"
                    )}
                    <div className="text-xs text-gray-500">
                      {p.reservation?.guest?.full_name || "—"} · {p.reservation?.property?.name || "—"}
                    </div>
                  </td>
                  <td className="px-4 py-2 text-xs text-gray-600 uppercase hidden md:table-cell">
                    {p.method}
                    {p.reference && (
                      <div className="text-[10px] font-mono text-gray-400 normal-case">
                        {p.reference}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <span className="font-mono text-sm font-semibold text-gray-900">
                      {formatCurrency(p.amount_cents)}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        p.status === "completed"
                          ? "bg-green-50 text-green-700"
                          : p.status === "pending"
                          ? "bg-amber-50 text-amber-700"
                          : p.status === "refunded"
                          ? "bg-gray-100 text-gray-600"
                          : "bg-red-50 text-red-700"
                      }`}
                    >
                      {p.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  subtitle,
  tone,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  subtitle?: string;
  tone?: "positive";
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-center gap-2 text-gray-400 mb-1">
        <Icon size={14} />
        <span className="text-[11px] font-semibold uppercase tracking-wider">{label}</span>
      </div>
      <div
        className={`text-xl lg:text-2xl font-bold ${
          tone === "positive" ? "text-green-700" : "text-gray-900"
        }`}
      >
        {value}
      </div>
      {subtitle && <div className="text-[11px] text-gray-500 mt-0.5">{subtitle}</div>}
    </div>
  );
}
