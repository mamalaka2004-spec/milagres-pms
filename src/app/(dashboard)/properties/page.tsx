import Link from "next/link";
import { Plus, Home } from "lucide-react";
import { getProperties } from "@/lib/db/queries/properties";
import { requireAuth } from "@/lib/auth";
import { PropertyCard } from "@/components/properties/property-card";
import { EmptyState } from "@/components/shared/empty-state";
import { ImportAirbnbButton } from "@/components/properties/import-airbnb-button";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ status?: string; search?: string }>;
}

export default async function PropertiesPage({ searchParams }: PageProps) {
  const user = await requireAuth();
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
            defaultValue={params.status || ""}
            className="px-3 py-2 rounded-lg border border-gray-200 text-sm font-body bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-400/20 focus:border-brand-400"
          >
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="maintenance">Maintenance</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <ImportAirbnbButton />
          <Link
            href="/properties/new"
            className="hidden lg:inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-brand-500 hover:bg-brand-600 text-white font-semibold text-sm transition"
          >
            <Plus size={16} /> Add Property
          </Link>
        </div>
      </div>

      {/* Grid or Empty */}
      {properties.length === 0 ? (
        <EmptyState
          icon={Home}
          title="No properties yet"
          description="Add your first property to start managing reservations and bookings."
          action={{ label: "+ Add Property", href: "/properties/new" }}
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
        className="lg:hidden fixed bottom-20 right-4 w-14 h-14 rounded-full bg-brand-500 hover:bg-brand-600 text-white shadow-lg flex items-center justify-center z-30"
      >
        <Plus size={24} />
      </Link>
    </div>
  );
}
