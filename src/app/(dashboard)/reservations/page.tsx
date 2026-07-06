import Link from "next/link";
import { Plus, CalendarDays, Star } from "lucide-react";
import { getReservations } from "@/lib/db/queries/reservations";
import { requirePageAuth } from "@/lib/auth";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader, Button, Input, Select, StatusBadge, EntityAvatar } from "@/components/ui";
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
  const user = await requirePageAuth();
  const params = await searchParams;
  const reservations = await getReservations(user.company_id, {
    status: params.status,
    channel: params.channel,
    property_id: params.property_id,
    search: params.search,
    from_date: params.from,
    to_date: params.to,
  });

  const hasFilters = Boolean(params.search || params.status || params.channel);

  return (
    <div className="space-y-4 lg:space-y-6">
      <PageHeader
        title="Reservas"
        subtitle={`${reservations.length} ${reservations.length === 1 ? "reserva" : "reservas"}${
          hasFilters ? " (filtradas)" : ""
        }`}
        actions={
          <Button asChild className="hidden lg:inline-flex">
            <Link href="/reservations/new">
              <Plus size={16} aria-hidden="true" /> Nova Reserva
            </Link>
          </Button>
        }
      />

      <form
        className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center"
        action="/reservations"
        method="GET"
      >
        <Input
          name="search"
          defaultValue={params.search || ""}
          placeholder="Código da reserva…"
          aria-label="Buscar por código da reserva"
          className="col-span-2 sm:flex-1 sm:min-w-[200px]"
        />
        <Select name="status" defaultValue={params.status || ""} aria-label="Filtrar por status" className="sm:w-auto">
          <option value="">Todos os status</option>
          {Object.entries(RESERVATION_STATUSES).map(([k, v]) => (
            <option key={k} value={k}>
              {v.label}
            </option>
          ))}
        </Select>
        <Select name="channel" defaultValue={params.channel || ""} aria-label="Filtrar por canal" className="sm:w-auto">
          <option value="">Todos os canais</option>
          {Object.entries(CHANNELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v.label}
            </option>
          ))}
        </Select>
        <Button type="submit" variant="secondary" className="col-span-2 sm:col-span-1">
          Filtrar
        </Button>
      </form>

      {reservations.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title={hasFilters ? "Nenhuma reserva corresponde aos filtros" : "Nenhuma reserva ainda"}
          description={hasFilters ? "Tente limpar os filtros." : "Crie sua primeira reserva para começar."}
          action={!hasFilters ? { label: "+ Nova Reserva", href: "/reservations/new" } : undefined}
        />
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-card overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Código</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Hóspede</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell">Imóvel</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell">Datas</th>
                <th className="px-4 py-3 text-right text-[11px] font-semibold text-gray-500 uppercase tracking-wider hidden lg:table-cell">Total</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {reservations.map((r) => {
                const { guest, property } = r;
                return (
                  <tr key={r.id} className="hover:bg-brand-50/40 transition-colors duration-150">
                    <td className="px-4 py-3">
                      <Link
                        href={`/reservations/${r.id}`}
                        className="font-mono text-xs font-semibold text-brand-700 hover:text-brand-800 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40 rounded"
                      >
                        {r.booking_code}
                      </Link>
                      <div className="mt-0.5">
                        <StatusBadge type="channel" value={r.channel} />
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <EntityAvatar
                          src={property?.cover_image_url}
                          name={guest?.full_name}
                          size={32}
                          className="hidden sm:flex"
                        />
                        <div className="min-w-0">
                          <div className="font-semibold text-sm text-gray-900 inline-flex items-center gap-1">
                            {guest?.full_name || "—"}
                            {guest?.is_vip && (
                              <Star size={11} className="text-amber-500" fill="currentColor" aria-hidden="true" />
                            )}
                          </div>
                          <div className="md:hidden text-xs text-gray-500 truncate">{property?.name}</div>
                        </div>
                      </div>
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
                        <StatusBadge type="reservation" value={r.status} />
                        <StatusBadge type="payment" value={r.payment_status} />
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
        aria-label="Nova reserva"
        className="lg:hidden fixed bottom-20 right-4 w-14 h-14 rounded-full bg-brand-500 hover:bg-brand-600 text-white shadow-card-hover flex items-center justify-center z-30 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40"
      >
        <Plus size={24} aria-hidden="true" />
      </Link>
    </div>
  );
}
