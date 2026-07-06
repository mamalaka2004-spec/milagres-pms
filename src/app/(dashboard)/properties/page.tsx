import Link from "next/link";
import { Plus, Home } from "lucide-react";
import { getProperties } from "@/lib/db/queries/properties";
import { requirePageAuth } from "@/lib/auth";
import { PropertyCard } from "@/components/properties/property-card";
import { EmptyState } from "@/components/shared/empty-state";
import { ImportAirbnbButton } from "@/components/properties/import-airbnb-button";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ status?: string; search?: string }>;
}

export default async function PropertiesPage({ searchParams }: PageProps) {
  const user = await requirePageAuth();
  const params = await searchParams;

  const properties = await getProperties(user.company_id, {
    status: params.status,
    search: params.search,
  });

  return (
    <div className="space-y-4 lg:space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center gap-3 flex-wrap">
        <div className="flex gap-2 flex-wrap">
          <select
            aria-label="Filtrar por status"
            defaultValue={params.status || ""}
            className="px-3 py-2 rounded-lg border border-gray-200 text-sm font-body bg-white text-gray-700 cursor-pointer transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-brand-400/20 focus:border-brand-400"
          >
            <option value="">Todos os status</option>
            <option value="active">Ativo</option>
            <option value="inactive">Inativo</option>
            <option value="maintenance">Manutenção</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <ImportAirbnbButton />
          <Link
            href="/properties/new"
            className="hidden lg:inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-brand-500 hover:bg-brand-600 text-white font-semibold text-sm transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40"
          >
            <Plus size={16} aria-hidden="true" /> Adicionar imóvel
          </Link>
        </div>
      </div>

      {/* Grid or Empty */}
      {properties.length === 0 ? (
        <EmptyState
          icon={Home}
          title="Nenhum imóvel ainda"
          description="Adicione seu primeiro imóvel para começar a gerenciar reservas."
          action={{ label: "+ Adicionar imóvel", href: "/properties/new" }}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 lg:gap-4">
          {properties.map((property) => (
            <PropertyCard key={property.id} property={property} />
          ))}
        </div>
      )}

      {/* Mobile FAB */}
      <Link
        href="/properties/new"
        aria-label="Adicionar imóvel"
        className="lg:hidden fixed bottom-20 right-4 w-14 h-14 rounded-full bg-brand-500 hover:bg-brand-600 text-white shadow-lg flex items-center justify-center z-30 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40"
      >
        <Plus size={24} aria-hidden="true" />
      </Link>
    </div>
  );
}
