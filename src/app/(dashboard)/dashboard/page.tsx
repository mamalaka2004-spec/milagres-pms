import Link from "next/link";
import { BedDouble, DollarSign, CalendarDays, CreditCard, Star } from "lucide-react";
import { StatsCard } from "@/components/dashboard/stats-card";
import { requireAuth } from "@/lib/auth";
import { getDashboardData } from "@/lib/db/queries/dashboard";
import {
  formatCurrency,
  formatCurrencyShort,
  getInitials,
} from "@/lib/utils/format";
import { ReservationStatusBadge, PaymentStatusBadge } from "@/components/shared/status-badges";

export const dynamic = "force-dynamic";

function StatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = {
    confirmed: "bg-green-500",
    pending: "bg-amber-500",
    in_progress: "bg-blue-500",
    completed: "bg-green-500",
    checked_in: "bg-blue-500",
  };
  return <span className={`inline-block w-2 h-2 rounded-full ${colors[status] || "bg-gray-400"}`} />;
}

export default async function DashboardPage() {
  const user = await requireAuth();
  const data = await getDashboardData(user.company_id);
  const s = data.stats;

  const occupancyValue = `${(s.occupancy_rate * 100).toFixed(0)}%`;
  const occupancySub = `${s.occupied_units} of ${s.active_units} units`;
  const revenueValue = formatCurrencyShort(s.monthly_revenue_cents);
  const revenueTrend =
    s.monthly_revenue_change_pct === 0
      ? null
      : `${s.monthly_revenue_change_pct > 0 ? "+" : ""}${s.monthly_revenue_change_pct.toFixed(0)}%`;

  return (
    <div className="space-y-4 lg:space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        <StatsCard
          label="Occupancy"
          value={occupancyValue}
          subtitle={occupancySub}
          icon={BedDouble}
        />
        <StatsCard
          label="Revenue"
          value={revenueValue}
          subtitle="This month"
          icon={DollarSign}
          trend={revenueTrend ?? undefined}
          trendUp={s.monthly_revenue_change_pct >= 0}
        />
        <StatsCard
          label="Reservations"
          value={String(s.reservations_this_month)}
          subtitle="This month"
          icon={CalendarDays}
        />
        <StatsCard
          label="Pending"
          value={formatCurrencyShort(s.pending_amount_cents)}
          subtitle={`${s.pending_count} unpaid`}
          icon={CreditCard}
        />
      </div>

      {/* Today's Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 lg:gap-4">
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
            <span className="text-brand-500">✈️</span>
            <span className="font-semibold text-sm text-gray-900">Check-ins Today</span>
            <span className="ml-auto bg-brand-100 text-brand-600 px-2 py-0.5 rounded-full text-[11px] font-bold">
              {data.today_checkins.length}
            </span>
          </div>
          {data.today_checkins.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-gray-400">No check-ins today.</div>
          ) : (
            data.today_checkins.map((ci) => (
              <Link
                key={ci.id}
                href={`/reservations/${ci.id}`}
                className="px-4 py-3 border-b border-gray-50 flex items-center gap-3 hover:bg-gray-50 transition"
              >
                <div className="w-9 h-9 rounded-full bg-brand-50 flex items-center justify-center text-brand-600 font-bold text-xs shrink-0">
                  {getInitials(ci.guest_name)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm text-gray-900 truncate inline-flex items-center gap-1">
                    {ci.guest_name}
                    {ci.is_vip && <Star size={11} className="text-amber-500" fill="currentColor" />}
                  </div>
                  <div className="text-xs text-gray-400">
                    {ci.property_name} · {ci.nights}n · {ci.booking_code}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <StatusDot status={ci.status} />
                  <span className="text-[10px] text-gray-400 capitalize">
                    {ci.status.replace("_", " ")}
                  </span>
                </div>
              </Link>
            ))
          )}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
            <span className="text-amber-500">🛫</span>
            <span className="font-semibold text-sm text-gray-900">Check-outs Today</span>
            <span className="ml-auto bg-amber-50 text-amber-600 px-2 py-0.5 rounded-full text-[11px] font-bold">
              {data.today_checkouts.length}
            </span>
          </div>
          {data.today_checkouts.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-gray-400">No check-outs today.</div>
          ) : (
            data.today_checkouts.map((co) => (
              <Link
                key={co.id}
                href={`/reservations/${co.id}`}
                className="px-4 py-3 border-b border-gray-50 flex items-center gap-3 hover:bg-gray-50 transition"
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
                    {co.cleaning_status ? co.cleaning_status.replace("_", " ") : "no task"}
                  </span>
                </div>
              </Link>
            ))
          )}
        </div>
      </div>

      {/* Recent reservations */}
      {data.recent_reservations.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <span className="font-semibold text-sm text-gray-900">Recent reservations</span>
            <Link href="/reservations" className="text-xs font-semibold text-brand-600 hover:text-brand-700">
              See all →
            </Link>
          </div>
          <div className="divide-y divide-gray-100">
            {data.recent_reservations.map((r) => (
              <Link
                key={r.id}
                href={`/reservations/${r.id}`}
                className="px-4 py-3 flex justify-between items-center gap-3 hover:bg-gray-50 transition"
              >
                <div className="min-w-0">
                  <div className="font-mono text-xs text-gray-500">{r.booking_code}</div>
                  <div className="font-semibold text-sm text-gray-900 truncate">
                    {r.guest_name}
                  </div>
                  <div className="text-xs text-gray-500">{r.property_name}</div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 flex-wrap justify-end">
                  <span className="font-mono text-sm font-semibold text-gray-900">
                    {formatCurrency(r.total_cents)}
                  </span>
                  <ReservationStatusBadge status={r.status as Parameters<typeof ReservationStatusBadge>[0]["status"]} />
                  <PaymentStatusBadge status={r.payment_status as Parameters<typeof PaymentStatusBadge>[0]["status"]} />
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="hidden lg:flex gap-3">
        <Link
          href="/reservations/new"
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg border border-brand-400 text-brand-600 font-semibold text-sm hover:bg-brand-50 transition"
        >
          + New Reservation
        </Link>
        <Link
          href="/calendar"
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg border border-gray-200 text-gray-600 font-semibold text-sm hover:bg-gray-50 transition"
        >
          View Calendar
        </Link>
        <Link
          href="/finance"
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg border border-gray-200 text-gray-600 font-semibold text-sm hover:bg-gray-50 transition"
        >
          Finance
        </Link>
      </div>
    </div>
  );
}
