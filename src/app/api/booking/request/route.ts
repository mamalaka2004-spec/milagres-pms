import { NextRequest } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPropertyBySlug } from "@/lib/db/queries/properties";
import { checkAvailability, getNextBookingSequence } from "@/lib/db/queries/reservations";
import { calculateReservationTotals } from "@/lib/validations/reservation";
import { apiSuccess, apiError, apiServerError } from "@/lib/api/response";

const bodySchema = z.object({
  slug: z.string().min(1).max(120),
  check_in_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  check_out_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  num_guests: z.coerce.number().int().min(1).max(50),
  guest_full_name: z.string().min(2).max(200),
  guest_email: z.string().email().max(254),
  guest_phone: z.string().min(6).max(40),
  guest_country: z.string().max(2).optional(),
  guest_language: z.string().max(10).default("pt-BR"),
  special_requests: z.string().max(1000).optional(),
  // Anti-spam: simple honeypot
  hp: z.string().max(0).optional().or(z.literal("")),
});

const MAX_BOOKING_NIGHTS = 365;
const todayISO = () => new Date().toISOString().slice(0, 10);

const BOOKING_PREFIX = "MIL";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validation = bodySchema.safeParse(body);
    if (!validation.success) {
      return apiError("Validation failed", 400, validation.error.flatten());
    }
    const data = validation.data;
    if (data.check_out_date <= data.check_in_date) {
      return apiError("Check-out must be after check-in", 400);
    }
    // Reject past-dated and absurdly-long bookings — common spam/fraud signals.
    if (data.check_in_date < todayISO()) {
      return apiError("Check-in must be today or in the future", 400);
    }
    {
      const ms =
        new Date(data.check_out_date).getTime() -
        new Date(data.check_in_date).getTime();
      const nights = Math.round(ms / (24 * 60 * 60 * 1000));
      if (nights > MAX_BOOKING_NIGHTS) {
        return apiError(`Reservation cannot exceed ${MAX_BOOKING_NIGHTS} nights`, 400);
      }
    }
    if (data.hp && data.hp.length > 0) {
      // Honeypot tripped. Return a generic validation error indistinguishable
      // from a normal failure so bots can't easily detect they hit a trap, but
      // also don't get a fake success that they could misuse.
      return apiError("Validation failed", 400);
    }

    const property = await getPropertyBySlug(data.slug);
    if (!property) return apiError("Property not found", 404);
    if (data.num_guests > property.max_guests) {
      return apiError(`Esta propriedade aceita até ${property.max_guests} hóspedes.`, 400);
    }

    // Availability
    const availability = await checkAvailability({
      property_id: property.id,
      check_in_date: data.check_in_date,
      check_out_date: data.check_out_date,
    });
    if (!availability.available) {
      return apiError("Datas indisponíveis para esta propriedade", 409, availability);
    }

    const ms = new Date(data.check_out_date).getTime() - new Date(data.check_in_date).getTime();
    const nights = Math.max(1, Math.round(ms / (24 * 60 * 60 * 1000)));

    if (nights < property.min_nights) {
      return apiError(`Estadia mínima de ${property.min_nights} noites.`, 400);
    }

    const base_amount_cents = property.base_price_cents * nights;
    const cleaning_fee_cents = property.cleaning_fee_cents;
    const extra_guest_fee_cents =
      property.extra_guest_after > 0 && data.num_guests > property.extra_guest_after
        ? property.extra_guest_fee_cents * (data.num_guests - property.extra_guest_after) * nights
        : 0;
    const totals = calculateReservationTotals({
      base_amount_cents,
      cleaning_fee_cents,
      extra_guest_fee_cents,
      discount_cents: 0,
      platform_fee_cents: 0,
      tax_cents: 0,
    });

    const supabase = createAdminClient();

    // Dedup guest by email (case-insensitive) or phone.
    // Normalizing keeps `Guest@x.com` and `guest@x.com` as the same record and
    // prevents enumeration via case variation.
    const normalizedEmail = data.guest_email.trim().toLowerCase();
    let guestId: string | null = null;
    {
      const { data: byEmail } = await supabase
        .from("guests")
        .select("id")
        .eq("company_id", property.company_id)
        .ilike("email", normalizedEmail)
        .limit(1)
        .maybeSingle();
      if (byEmail) {
        guestId = (byEmail as { id: string }).id;
      } else if (data.guest_phone) {
        const { data: byPhone } = await supabase
          .from("guests")
          .select("id")
          .eq("company_id", property.company_id)
          .eq("phone", data.guest_phone)
          .is("email", null)
          .limit(1)
          .maybeSingle();
        if (byPhone) guestId = (byPhone as { id: string }).id;
      }
    }
    if (!guestId) {
      const { data: created, error: gErr } = await (supabase.from("guests") as any) // eslint-disable-line @typescript-eslint/no-explicit-any
        .insert({
          company_id: property.company_id,
          full_name: data.guest_full_name,
          email: normalizedEmail,
          phone: data.guest_phone,
          country: data.guest_country || null,
          language: data.guest_language,
          is_vip: false,
          total_stays: 0,
          total_spent_cents: 0,
        })
        .select("id")
        .single();
      if (gErr) throw gErr;
      guestId = (created as { id: string }).id;
    }

    // Booking code
    const year = new Date().getFullYear();
    const seq = await getNextBookingSequence(property.company_id, BOOKING_PREFIX, year);
    const booking_code = `${BOOKING_PREFIX}-${year}-${String(seq).padStart(4, "0")}`;

    // Status: instant_booking → pending (still requires admin confirmation OF payment) or 'inquiry' otherwise
    const status: "pending" | "inquiry" = property.instant_booking_enabled ? "pending" : "inquiry";

    const { data: reservation, error: resErr } = await (supabase.from("reservations") as any) // eslint-disable-line @typescript-eslint/no-explicit-any
      .insert({
        company_id: property.company_id,
        property_id: property.id,
        guest_id: guestId,
        booking_code,
        channel: "direct",
        check_in_date: data.check_in_date,
        check_out_date: data.check_out_date,
        nights,
        num_guests: data.num_guests,
        num_adults: data.num_guests,
        num_children: 0,
        status,
        payment_status: "unpaid",
        base_amount_cents,
        cleaning_fee_cents,
        extra_guest_fee_cents,
        discount_cents: 0,
        platform_fee_cents: 0,
        tax_cents: 0,
        ...totals,
        special_requests: data.special_requests || null,
      })
      .select("id, booking_code, status")
      .single();
    if (resErr) {
      const msg = (resErr as { message?: string }).message || "Failed to create reservation";
      // The DB trigger may reject overlap — return 409
      if (msg.toLowerCase().includes("overlap") || msg.toLowerCase().includes("blocked")) {
        return apiError(msg, 409);
      }
      throw resErr;
    }

    return apiSuccess({
      booking_code: (reservation as { booking_code: string }).booking_code,
      status: (reservation as { status: string }).status,
      reservation_id: (reservation as { id: string }).id,
      total_cents: totals.total_cents,
      nights,
    });
  } catch (error) {
    return apiServerError(error);
  }
}
