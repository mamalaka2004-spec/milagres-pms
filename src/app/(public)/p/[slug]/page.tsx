import { notFound } from "next/navigation";
import { MapPin, Users, BedDouble, Bath, Clock, Shield } from "lucide-react";
import { getPropertyBySlug } from "@/lib/db/queries/properties";
import { SiteHeader, SiteFooter } from "@/components/public/site-header";
import { PropertyGallery } from "@/components/public/property-gallery";
import { BookingWidget } from "@/components/public/booking-widget";

export const dynamic = "force-dynamic";

const WHATSAPP_URL = `https://wa.me/${process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "5582999999999"}`;

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function PublicPropertyPage({ params }: PageProps) {
  const { slug } = await params;
  const property = await getPropertyBySlug(slug);
  if (!property) notFound();

  const amenities = (property.property_amenities || []).map((pa) => pa.amenity).filter(Boolean);
  const groupedAmenities: Record<string, typeof amenities> = {};
  for (const a of amenities) {
    const cat = a.category || "general";
    if (!groupedAmenities[cat]) groupedAmenities[cat] = [];
    groupedAmenities[cat].push(a);
  }

  return (
    <div className="min-h-screen bg-cream font-body">
      <SiteHeader whatsappUrl={WHATSAPP_URL} />

      <div className="pt-20 md:pt-24 pb-16 px-4 md:px-8">
        <div className="max-w-6xl mx-auto">
          {/* Title */}
          <div className="mb-6">
            <div className="text-[11px] font-semibold tracking-[0.3em] uppercase text-brand-500 mb-2">
              {property.code}
            </div>
            <h1 className="font-heading text-3xl md:text-5xl font-normal text-gray-900 mb-2 leading-tight">
              {property.name}
            </h1>
            {property.subtitle && (
              <p className="text-gray-600 text-base md:text-lg mb-3">{property.subtitle}</p>
            )}
            <div className="flex flex-wrap gap-3 text-sm text-gray-500">
              {property.city && (
                <span className="inline-flex items-center gap-1">
                  <MapPin size={14} className="text-brand-500" />
                  {[property.city, property.state].filter(Boolean).join(", ")}
                </span>
              )}
              <span className="inline-flex items-center gap-1">
                <Users size={14} className="text-brand-400" />
                {property.max_guests} hóspedes
              </span>
              <span className="inline-flex items-center gap-1">
                <BedDouble size={14} className="text-brand-400" />
                {property.bedrooms} {property.bedrooms === 1 ? "quarto" : "quartos"} · {property.beds}{" "}
                {property.beds === 1 ? "cama" : "camas"}
              </span>
              <span className="inline-flex items-center gap-1">
                <Bath size={14} className="text-brand-400" />
                {property.bathrooms} {property.bathrooms === 1 ? "banheiro" : "banheiros"}
              </span>
            </div>
          </div>

          {/* Layout: gallery + booking widget */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-10">
            <div className="lg:col-span-2 space-y-8">
              <PropertyGallery
                images={property.property_images || []}
                fallback={property.cover_image_url}
                alt={property.name}
              />

              {/* Description */}
              {property.description && (
                <section>
                  <h2 className="font-heading text-2xl font-normal text-gray-900 mb-3">
                    Sobre o espaço
                  </h2>
                  <p className="text-gray-600 leading-relaxed whitespace-pre-line">
                    {property.description}
                  </p>
                </section>
              )}

              {/* Amenities */}
              {amenities.length > 0 && (
                <section>
                  <h2 className="font-heading text-2xl font-normal text-gray-900 mb-3">
                    O que esta acomodação oferece
                  </h2>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {amenities.slice(0, 18).map((a) => (
                      <div
                        key={a.id}
                        className="flex items-center gap-2 text-sm text-gray-700 py-2"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-brand-500" />
                        {a.name_pt || a.name}
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Rules */}
              {property.house_rules && (
                <section className="bg-white rounded-2xl border border-brand-100 p-5 md:p-6">
                  <h2 className="font-heading text-xl font-medium text-gray-900 mb-3">
                    Regras da casa
                  </h2>
                  <p className="text-sm text-gray-600 whitespace-pre-line leading-relaxed">
                    {property.house_rules}
                  </p>
                  <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t border-brand-100 text-xs text-gray-500">
                    <span className="inline-flex items-center gap-1.5">
                      <Clock size={12} className="text-brand-500" /> Check-in: {property.check_in_time?.slice(0, 5)}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <Clock size={12} className="text-brand-500" /> Check-out: {property.check_out_time?.slice(0, 5)}
                    </span>
                  </div>
                </section>
              )}

              {/* Cancellation */}
              {property.cancellation_policy && (
                <section className="bg-white rounded-2xl border border-brand-100 p-5 md:p-6">
                  <h2 className="font-heading text-xl font-medium text-gray-900 mb-3 inline-flex items-center gap-2">
                    <Shield size={18} className="text-brand-500" /> Política de cancelamento
                  </h2>
                  <p className="text-sm text-gray-600 leading-relaxed">{property.cancellation_policy}</p>
                </section>
              )}
            </div>

            {/* Booking widget — sticky on desktop */}
            <div className="lg:col-span-1">
              <div className="lg:sticky lg:top-24">
                <BookingWidget
                  propertyId={property.id}
                  slug={property.slug}
                  basePriceCents={property.base_price_cents}
                  cleaningFeeCents={property.cleaning_fee_cents}
                  extraGuestFeeCents={property.extra_guest_fee_cents}
                  extraGuestAfter={property.extra_guest_after}
                  maxGuests={property.max_guests}
                  minNights={property.min_nights}
                  instantBooking={property.instant_booking_enabled}
                  whatsappUrl={WHATSAPP_URL}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <SiteFooter whatsappUrl={WHATSAPP_URL} />
    </div>
  );
}
