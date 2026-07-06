import Link from "next/link";
import { Plus, Users, Star } from "lucide-react";
import { getGuests } from "@/lib/db/queries/guests";
import { requirePageAuth } from "@/lib/auth";
import { EmptyState } from "@/components/shared/empty-state";
import { formatCurrency, formatPhone } from "@/lib/utils/format";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ search?: string; vip?: string }>;
}

export default async function GuestsPage({ searchParams }: PageProps) {
  const user = await requirePageAuth();
  const params = await searchParams;
  const guests = await getGuests(user.company_id, {
    search: params.search,
    is_vip: params.vip === "true" ? true : undefined,
  });

  return (
    <div className="space-y-4 lg:space-y-6">
      <div className="flex justify-between items-center gap-3 flex-wrap">
        <h1 className="text-xl lg:text-2xl font-bold text-gray-900">Hóspedes</h1>
        <Link
          href="/guests/new"
          className="hidden lg:inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-brand-500 hover:bg-brand-600 text-white font-semibold text-sm transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40"
        >
          <Plus size={16} aria-hidden="true" /> Adicionar hóspede
        </Link>
      </div>

      <form className="flex gap-2" action="/guests" method="GET">
        <input
          name="search"
          aria-label="Buscar hóspedes"
          defaultValue={params.search || ""}
          placeholder="Buscar por nome, e-mail ou telefone..."
          className="flex-1 px-4 py-2.5 rounded-lg border border-gray-200 text-sm transition-colors duration-200 focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-400/15"
        />
        <button
          type="submit"
          className="px-4 py-2.5 rounded-lg bg-gray-100 text-gray-700 text-sm font-semibold hover:bg-gray-200 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40"
        >
          Buscar
        </button>
      </form>

      {guests.length === 0 ? (
        <EmptyState
          icon={Users}
          title={params.search ? "Nenhum hóspede corresponde à busca" : "Nenhum hóspede ainda"}
          description={
            params.search
              ? "Tente outro termo de busca."
              : "Adicione seu primeiro hóspede para acompanhar estadias e preferências."
          }
          action={!params.search ? { label: "+ Adicionar hóspede", href: "/guests/new" } : undefined}
        />
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                  Nome
                </th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell">
                  Contato
                </th>
                <th className="px-4 py-3 text-right text-[11px] font-semibold text-gray-500 uppercase tracking-wider hidden lg:table-cell">
                  Estadias
                </th>
                <th className="px-4 py-3 text-right text-[11px] font-semibold text-gray-500 uppercase tracking-wider hidden lg:table-cell">
                  Gasto
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {guests.map((g) => (
                <tr key={g.id} className="hover:bg-gray-50 transition-colors duration-150">
                  <td className="px-4 py-3">
                    <Link
                      href={`/guests/${g.id}`}
                      className="font-semibold text-gray-900 hover:text-brand-600 inline-flex items-center gap-2 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40 rounded"
                    >
                      {g.full_name}
                      {g.is_vip && (
                        <Star size={12} aria-label="VIP" className="text-amber-500" fill="currentColor" />
                      )}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 hidden md:table-cell">
                    <div className="space-y-0.5">
                      {g.email && <div className="text-xs">{g.email}</div>}
                      {g.phone && (
                        <div className="text-xs text-gray-500 font-mono">
                          {formatPhone(g.phone)}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700 text-right hidden lg:table-cell">
                    {g.total_stays}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700 text-right hidden lg:table-cell font-mono">
                    {formatCurrency(g.total_spent_cents)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Link
        href="/guests/new"
        aria-label="Adicionar hóspede"
        className="lg:hidden fixed bottom-20 right-4 w-14 h-14 rounded-full bg-brand-500 hover:bg-brand-600 text-white shadow-lg flex items-center justify-center z-30 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40"
      >
        <Plus size={24} aria-hidden="true" />
      </Link>
    </div>
  );
}
