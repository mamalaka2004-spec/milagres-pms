import Link from "next/link";
import { Plus, CalendarDays, Star } from "lucide-react";
import { getReservations } from "@/lib/db/queries/reservations";
import { requireAuth } from "@/lib/auth";
import { EmptyState } from "@/components/shared/empty-state";
import {
  ReservationStatusBadge,
  PaymentStatusBadge,
  ChannelBadge,
} from "@/components/shared/status-badges";
import { formatCurrency, formatDate } from "@/lib/utils/format";
import { RESERVATION_STATUSES, CHANNELS } from "@/lib/utils/constants";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{
    status?: string;
    channel?: string;
    property_id?: string;
    search?: string;
    from?: string;
    to?: string;
  }>;
}

export default async function ReservationsPage({ searchParams }: PageProps) {
  const user = await requireAuth();
  const params = await searchParams;
  const reservations = await getReservations(user.company_id, {
    status: params.status,
    channel: params.channel,
    property_id: params.property_id,
    search: params.search,
    from_date: params.from,
    to_date: params.to,
  });

  return (
    <div className="space-y-4 lg:space-y-6">
      <div className="flex justify-between items-center gap-3 flex-wrap">
        <h1 className="text-xl lg:text-2xl font-bold text-gray-900">Reservations</h1>
        <Link
          href="/reservations/new"
          className="hidden lg:inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-brand-500 hover:bg-brand-600 text-white font-semibold text-sm transition"
        >
          <Plus size={16} /> New Reservation
        </Link>
      </div>

      <form className="flex flex-wrap gap-2" action="/reservations" method="GET">
        <input
          name="search"
          defaultValue={params.search || ""}
          placeholder="Booking code..."
          className="flex-1 min-w-[180px] px-4 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-brand-400"
        />
        <select
          name="status"
          defaultValue={params.status || ""}
          className="px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white"
        >
          <option value="">All statuses</option>
          {Object.entries(RESERVATION_STATUSES).map(([k, v]) => (
            <option key={k} value={k}>
              {v.label}
            </option>
          ))}
        </select>
        <select
          name="channel"
          defaultValue={params.channel || ""}
          className="px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white"
        >
          <option value="">All channels</option>
          {Object.entries(CHANNELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v.label}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="px-4 py-2 rounded-lg bg-gray-100 text-gray-700 text-sm font-semibold hover:bg-gray-200"
        >
          Filter
        </button>
      </form>

      {reservations.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title={params.search || params.status ? "No reservations match your filters" : "No reservations yet"}
          description={
            params.search || params.status
              ? "Try clearing the filters."
              : "Create your first reservation to start tracking bookings."
          }
          action={!params.search && !params.status ? { label: "+ New Reservation", href: "/reservations/new" } : undefined}
        />
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Code</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Guest</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell">Property</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell">Dates</th>
                <th className="px-4 py-3 text-right text-[11px] font-semibold text-gray-500 uppercase tracking-wider hidden lg:table-cell">Total</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {reservations.map((r) => {
                const { guest, property } = r;
                return (
                  <tr key={r.id} className="hover:bg-gray-50 transition">
                    <td className="px-4 py-3">
                      <Link href={`/reservations/${r.id}`} className="font-mono text-xs font-semibold text-brand-700 hover:text-brand-800">
                        {r.booking_code}
                      </Link>
                      <div className="mt-0.5">
                        <ChannelBadge channel={r.channel} />
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-sm text-gray-900 inline-flex items-center gap-1">
                        {guest?.full_name || "—"}
                        {guest?.is_vip && (
                          <Star size={11} className="text-amber-500" fill="currentColor" />
                        )}
                      </div>
                      <div className="md:hidden text-xs text-gray-500">{property?.name}</div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700 hidden md:table-cell">
                      {property?.name || "—"}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600 hidden md:table-cell">
                      <div>{formatDate(r.check_in_date)}</div>
                      <div className="text-gray-400">→ {formatDate(r.check_out_date)}</div>
                      <div className="text-[10px] text-gray-400 uppercase tracking-wider mt-0.5">
                        {r.nights} {r.nights === 1 ? "noite" : "noites"}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right hidden lg:table-cell">
                      <div className="font-mono text-sm font-semibold text-gray-900">
                        {formatCurrency(r.total_cents)}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1.5">
                        <ReservationStatusBadge status={r.status} />
                        <PaymentStatusBadge status={r.payment_status} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Link
        href="/reservations/new"
        className="lg:hidden fixed bottom-20 right-4 w-14 h-14 rounded-full bg-brand-500 hover:bg-brand-600 text-white shadow-lg flex items-center justify-center z-30"
      >
        <Plus size={24} />
      </Link>
    </div>
  );
}
