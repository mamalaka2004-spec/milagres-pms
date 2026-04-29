import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { getPropertyBySlug } from "@/lib/db/queries/properties";
import { SiteHeader, SiteFooter } from "@/components/public/site-header";
import { BookingForm } from "@/components/public/booking-form";

export const dynamic = "force-dynamic";

const WHATSAPP_URL = `https://wa.me/${process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "5582999999999"}`;

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ check_in?: string; check_out?: string; guests?: string }>;
}

export default async function BookPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const sp = await searchParams;

  const property = await getPropertyBySlug(slug);
  if (!property) notFound();

  const checkIn = sp.check_in;
  const checkOut = sp.check_out;
  const guests = parseInt(sp.guests || "0", 10) || 2;

  // Require dates — if missing, send user back to the property page to pick them
  if (!checkIn || !checkOut || !/^\d{4}-\d{2}-\d{2}$/.test(checkIn) || !/^\d{4}-\d{2}-\d{2}$/.test(checkOut)) {
    redirect(`/p/${slug}`);
  }

  const cover =
    property.property_images?.find((i) => i.is_cover)?.url ||
    property.property_images?.[0]?.url ||
    property.cover_image_url;

  return (
    <div className="min-h-screen bg-cream font-body">
      <SiteHeader whatsappUrl={WHATSAPP_URL} />

      <div className="pt-20 md:pt-24 pb-16 px-4 md:px-8">
        <div className="max-w-6xl mx-auto">
          <Link
            href={`/p/${slug}`}
            className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-brand-600 mb-5"
          >
            <ArrowLeft size={14} /> Voltar para a propriedade
          </Link>

          <BookingForm
            slug={slug}
            propertyName={property.name}
            propertyImageUrl={cover}
            basePriceCents={property.base_price_cents}
            cleaningFeeCents={property.cleaning_fee_cents}
            extraGuestFeeCents={property.extra_guest_fee_cents}
            extraGuestAfter={property.extra_guest_after}
            maxGuests={property.max_guests}
            minNights={property.min_nights}
            initial={{
              check_in_date: checkIn,
              check_out_date: checkOut,
              num_guests: Math.min(guests, property.max_guests),
            }}
            instantBooking={property.instant_booking_enabled}
            whatsappUrl={WHATSAPP_URL}
          />
        </div>
      </div>

      <SiteFooter whatsappUrl={WHATSAPP_URL} />
    </div>
  );
}
