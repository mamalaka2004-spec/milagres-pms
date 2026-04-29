import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { getProperties } from "@/lib/db/queries/properties";
import { getGuestById } from "@/lib/db/queries/guests";
import { ReservationForm } from "@/components/reservations/reservation-form";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ guest_id?: string }>;
}

export default async function NewReservationPage({ searchParams }: PageProps) {
  const user = await requireAuth();
  const params = await searchParams;

  const properties = (await getProperties(user.company_id, { status: "active" })) as unknown as Array<{
    id: string;
    name: string;
    code: string;
    max_guests: number;
    base_price_cents: number;
    cleaning_fee_cents: number;
    extra_guest_fee_cents: number;
    extra_guest_after: number;
  }>;
  if (properties.length === 0) {
    redirect("/properties/new");
  }

  let initialGuest = null;
  if (params.guest_id) {
    try {
      const guest = await getGuestById(params.guest_id);
      if (guest && guest.company_id === user.company_id) {
        initialGuest = {
          id: guest.id,
          full_name: guest.full_name,
          email: guest.email,
          phone: guest.phone,
          is_vip: guest.is_vip,
        };
      }
    } catch {
      // ignore — fall back to no preselection
    }
  }

  const propertyOptions = properties.map((p) => ({
    id: p.id,
    name: p.name,
    code: p.code,
    max_guests: p.max_guests,
    base_price_cents: p.base_price_cents,
    cleaning_fee_cents: p.cleaning_fee_cents,
    extra_guest_fee_cents: p.extra_guest_fee_cents,
    extra_guest_after: p.extra_guest_after,
  }));

  return <ReservationForm properties={propertyOptions} initialGuest={initialGuest} />;
}
