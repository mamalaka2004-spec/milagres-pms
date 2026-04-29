import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Edit, Users, BedDouble, Bath, MapPin, Clock } from "lucide-react";
import { getPropertyById } from "@/lib/db/queries/properties";
import { requireAuth } from "@/lib/auth";
import { formatCurrency } from "@/lib/utils/format";
import { PhotoGallery } from "@/components/properties/photo-gallery";
import { AmenitySelector } from "@/components/properties/amenity-selector";
import { ChannelSyncPanel } from "@/components/properties/channel-sync-panel";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function PropertyDetailPage({ params }: PageProps) {
  const user = await requireAuth();
  const { id } = await params;

  let property;
  try {
    property = await getPropertyById(id);
  } catch {
    notFound();
  }

  if (!property || property.company_id !== user.company_id) {
    notFound();
  }

  return (
    <div className="space-y-4 lg:space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <Link
            href="/properties"
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition"
          >
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="text-xl lg:text-2xl font-bold text-gray-900">{property.name}</h1>
            <div className="text-xs text-gray-400 font-mono mt-0.5">{property.code}</div>
          </div>
        </div>
        <Link
          href={`/properties/${id}/edit`}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-500 hover:bg-brand-600 text-white font-semibold text-sm transition"
        >
          <Edit size={15} /> Edit
        </Link>
      </div>

      {/* Cover */}
      <div className="h-48 md:h-64 lg:h-80 rounded-2xl bg-gradient-to-br from-brand-300 to-brand-600 overflow-hidden">
        {property.cover_image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={property.cover_image_url} alt={property.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-6xl">🏡</div>
        )}
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { icon: Users, label: "Max Guests", value: property.max_guests },
          { icon: BedDouble, label: "Bedrooms", value: property.bedrooms },
          { icon: BedDouble, label: "Beds", value: property.beds },
          { icon: Bath, label: "Bathrooms", value: property.bathrooms },
        ].map((stat, i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-2 text-gray-400 mb-1">
              <stat.icon size={14} />
              <span className="text-xs font-medium uppercase tracking-wider">{stat.label}</span>
            </div>
            <div className="text-2xl font-bold text-gray-900">{stat.value}</div>
          </div>
        ))}
      </div>

      {/* Pricing */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 lg:p-6">
        <h2 className="text-sm font-bold text-gray-900 mb-4 uppercase tracking-wider">Pricing</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <div className="text-xs text-gray-400 uppercase tracking-wider mb-1">Base Price</div>
            <div className="font-heading text-2xl text-brand-600">
              {formatCurrency(property.base_price_cents)}
              <span className="text-sm text-gray-400 font-body"> /night</span>
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-400 uppercase tracking-wider mb-1">Cleaning Fee</div>
            <div className="font-heading text-xl text-gray-700">
              {formatCurrency(property.cleaning_fee_cents)}
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-400 uppercase tracking-wider mb-1">Min / Max Nights</div>
            <div className="font-heading text-xl text-gray-700">
              {property.min_nights} / {property.max_nights}
            </div>
          </div>
        </div>
      </div>

      {/* Location */}
      {(property.address || property.neighborhood || property.city) && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 lg:p-6">
          <h2 className="text-sm font-bold text-gray-900 mb-4 uppercase tracking-wider">Location</h2>
          <div className="flex items-start gap-3 text-sm text-gray-600">
            <MapPin size={16} className="text-brand-500 mt-0.5 shrink-0" />
            <div>
              {property.address && <div>{property.address}</div>}
              <div>
                {[property.neighborhood, property.city, property.state].filter(Boolean).join(", ")}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Description */}
      {property.description && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 lg:p-6">
          <h2 className="text-sm font-bold text-gray-900 mb-3 uppercase tracking-wider">About</h2>
          <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">
            {property.description}
          </p>
        </div>
      )}

      {/* House Rules */}
      {property.house_rules && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 lg:p-6">
          <h2 className="text-sm font-bold text-gray-900 mb-3 uppercase tracking-wider">House Rules</h2>
          <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">{property.house_rules}</p>
          <div className="flex items-center gap-4 mt-4 pt-4 border-t border-gray-100 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <Clock size={12} /> Check-in: {property.check_in_time}
            </span>
            <span className="flex items-center gap-1">
              <Clock size={12} /> Check-out: {property.check_out_time}
            </span>
          </div>
        </div>
      )}

      {/* Photos */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 lg:p-6">
        <h2 className="text-sm font-bold text-gray-900 mb-4 uppercase tracking-wider">Photos</h2>
        <PhotoGallery
          propertyId={property.id}
          initialImages={(property.property_images || []).map((img) => ({
            id: img.id,
            url: img.url,
            is_cover: img.is_cover || false,
            alt_text: img.alt_text,
          }))}
        />
      </div>

      {/* Amenities */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 lg:p-6">
        <h2 className="text-sm font-bold text-gray-900 mb-4 uppercase tracking-wider">Amenities</h2>
        <AmenitySelector
          propertyId={property.id}
          initialSelectedIds={(property.property_amenities || []).map((pa) => pa.amenity.id)}
        />
      </div>

      {/* Channel Sync */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 lg:p-6">
        <h2 className="text-sm font-bold text-gray-900 mb-4 uppercase tracking-wider">Channel Sync</h2>
        <ChannelSyncPanel
          propertyId={property.id}
          airbnbIcalUrl={property.airbnb_ical_url}
          bookingIcalUrl={property.booking_ical_url}
          airbnbListingUrl={property.airbnb_listing_url}
          bookingListingUrl={property.booking_listing_url}
          airbnbLastSyncedAt={property.airbnb_last_synced_at}
          bookingLastSyncedAt={property.booking_last_synced_at}
        />
      </div>

      {/* Settings */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 lg:p-6">
        <h2 className="text-sm font-bold text-gray-900 mb-4 uppercase tracking-wider">Settings</h2>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Status</span>
            <span className="font-semibold text-gray-900 capitalize">{property.status}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Instant Booking</span>
            <span className="font-semibold text-gray-900">
              {property.instant_booking_enabled ? "Enabled" : "Disabled"}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Featured</span>
            <span className="font-semibold text-gray-900">
              {property.is_featured ? "Yes" : "No"}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Public URL</span>
            <span className="font-mono text-xs text-brand-600">/properties/{property.slug}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
