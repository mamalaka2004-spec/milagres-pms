import { notFound } from "next/navigation";
import { getPropertyById } from "@/lib/db/queries/properties";
import { requireAuth } from "@/lib/auth";
import { PropertyForm } from "@/components/properties/property-form";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditPropertyPage({ params }: PageProps) {
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

  // Map cents to reais for form
  const initialData = {
    id: property.id,
    name: property.name,
    code: property.code,
    slug: property.slug,
    status: property.status as "active" | "inactive" | "maintenance",
    type: property.type as "apartment" | "house" | "studio" | "villa" | "cabin" | "room" | "other" | undefined,
    address: property.address || undefined,
    neighborhood: property.neighborhood || undefined,
    city: property.city || undefined,
    state: property.state || undefined,
    country: property.country,
    max_guests: property.max_guests,
    bedrooms: property.bedrooms,
    beds: property.beds,
    bathrooms: property.bathrooms,
    title: property.title || undefined,
    subtitle: property.subtitle || undefined,
    description: property.description || undefined,
    house_rules: property.house_rules || undefined,
    cancellation_policy: property.cancellation_policy || undefined,
    check_in_time: property.check_in_time.substring(0, 5),
    check_out_time: property.check_out_time.substring(0, 5),
    min_nights: property.min_nights,
    max_nights: property.max_nights,
    base_price: property.base_price_cents / 100,
    cleaning_fee: property.cleaning_fee_cents / 100,
    extra_guest_fee: property.extra_guest_fee_cents / 100,
    extra_guest_after: property.extra_guest_after,
    instant_booking_enabled: property.instant_booking_enabled,
    is_featured: property.is_featured,
    airbnb_ical_url: property.airbnb_ical_url || undefined,
    booking_ical_url: property.booking_ical_url || undefined,
    airbnb_listing_url: property.airbnb_listing_url || undefined,
    booking_listing_url: property.booking_listing_url || undefined,
  };

  return (
    <div className="max-w-4xl mx-auto">
      <PropertyForm initialData={initialData} />
    </div>
  );
}
