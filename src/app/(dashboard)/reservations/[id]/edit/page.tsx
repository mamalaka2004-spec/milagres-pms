import { notFound } from "next/navigation";
import { getReservationById } from "@/lib/db/queries/reservations";
import { getProperties } from "@/lib/db/queries/properties";
import { requirePageAuth } from "@/lib/auth";
import {
  ReservationEditForm,
  type ReservationEditInitial,
} from "@/components/reservations/reservation-edit-form";
import type { CHANNEL_VALUES } from "@/lib/validations/reservation";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditReservationPage({ params }: PageProps) {
  const user = await requirePageAuth();
  const { id } = await params;

  let r;
  try {
    r = await getReservationById(id);
  } catch {
    notFound();
  }
  if (!r || r.company_id !== user.company_id) notFound();

  const properties = (await getProperties(user.company_id, { status: "active" })) as unknown as Array<{
    id: string;
    name: string;
    code: string;
    max_guests: number;
  }>;

  // Ensure the reservation's current property is selectable even if inactive.
  const propertyOptions = properties.map((p) => ({
    id: p.id,
    name: p.name,
    code: p.code,
    max_guests: p.max_guests,
  }));
  if (r.property && !propertyOptions.some((p) => p.id === r.property!.id)) {
    propertyOptions.unshift({
      id: r.property.id,
      name: r.property.name,
      code: r.property.code,
      max_guests: r.property.max_guests,
    });
  }

  const initial: ReservationEditInitial = {
    id: r.id,
    booking_code: r.booking_code,
    property_id: r.property_id,
    channel: r.channel as (typeof CHANNEL_VALUES)[number],
    channel_ref: r.channel_ref,
    check_in_date: r.check_in_date,
    check_out_date: r.check_out_date,
    num_guests: r.num_guests,
    num_adults: r.num_adults,
    num_children: r.num_children,
    status: r.status,
    payment_status: r.payment_status,
    base_amount: r.base_amount_cents / 100,
    cleaning_fee: r.cleaning_fee_cents / 100,
    extra_guest_fee: r.extra_guest_fee_cents / 100,
    discount: r.discount_cents / 100,
    platform_fee: r.platform_fee_cents / 100,
    tax: r.tax_cents / 100,
    special_requests: r.special_requests,
    internal_notes: r.internal_notes,
    guest: r.guest
      ? { id: r.guest.id, full_name: r.guest.full_name, is_vip: r.guest.is_vip }
      : null,
  };

  return <ReservationEditForm reservation={initial} properties={propertyOptions} />;
}
