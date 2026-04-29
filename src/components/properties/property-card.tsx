import Link from "next/link";
import { Users, BedDouble, Bath } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { formatCurrency } from "@/lib/utils/format";
import type { Database } from "@/types/database";

type Property = Database["public"]["Tables"]["properties"]["Row"];

interface PropertyCardProps {
  property: Property & {
    property_images?: Array<{ url: string; is_cover: boolean }>;
  };
}

const statusStyles = {
  active: { bg: "bg-green-50", text: "text-green-700", label: "Active" },
  inactive: { bg: "bg-gray-50", text: "text-gray-600", label: "Inactive" },
  maintenance: { bg: "bg-amber-50", text: "text-amber-700", label: "Maintenance" },
};

export function PropertyCard({ property }: PropertyCardProps) {
  const status = statusStyles[property.status];
  const cover = property.property_images?.find((img) => img.is_cover) ||
    property.property_images?.[0];

  return (
    <Link
      href={`/properties/${property.id}`}
      className="group bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200"
    >
      {/* Cover image */}
      <div className="relative h-32 md:h-36 lg:h-40 bg-gradient-to-br from-brand-100 to-brand-50 overflow-hidden">
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={cover.url}
            alt={property.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-4xl">
            🏡
          </div>
        )}

        {/* Status badge */}
        <div className="absolute top-3 right-3">
          <span
            className={cn(
              "inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold",
              status.bg,
              status.text
            )}
          >
            {status.label}
          </span>
        </div>

        {/* Featured badge */}
        {property.is_featured && (
          <div className="absolute top-3 left-3">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-brand-500 text-white">
              ⭐ Featured
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        <div className="flex justify-between items-start gap-2 mb-1">
          <h3 className="font-bold text-base text-gray-900 leading-tight line-clamp-1">
            {property.name}
          </h3>
        </div>
        <div className="text-[11px] text-gray-400 font-mono mb-3">{property.code}</div>

        {/* Capacity */}
        <div className="flex gap-3 text-xs text-gray-500 mb-4">
          <span className="flex items-center gap-1">
            <Users size={12} className="text-brand-400" />
            {property.max_guests}
          </span>
          <span className="flex items-center gap-1">
            <BedDouble size={12} className="text-brand-400" />
            {property.beds}
          </span>
          <span className="flex items-center gap-1">
            <Bath size={12} className="text-brand-400" />
            {property.bathrooms}
          </span>
        </div>

        {/* Price */}
        <div className="pt-3 border-t border-gray-100 flex justify-between items-baseline">
          <div>
            <span className="font-bold text-brand-600 text-base">
              {formatCurrency(property.base_price_cents)}
            </span>
            <span className="text-[11px] text-gray-400"> /noite</span>
          </div>
          {property.instant_booking_enabled && (
            <span className="text-[9px] text-green-600 font-semibold uppercase tracking-wider">
              Instant
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
