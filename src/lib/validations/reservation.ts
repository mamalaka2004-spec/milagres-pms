import { z } from "zod";

export const RESERVATION_STATUS_VALUES = [
  "inquiry",
  "pending",
  "confirmed",
  "checked_in",
  "checked_out",
  "canceled",
  "no_show",
] as const;

export const PAYMENT_STATUS_VALUES = [
  "unpaid",
  "partially_paid",
  "paid",
  "refunded",
] as const;

export const CHANNEL_VALUES = [
  "direct",
  "airbnb",
  "booking",
  "expedia",
  "vrbo",
  "manual",
  "other",
] as const;

const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in format YYYY-MM-DD");

const baseReservationFields = {
  property_id: z.string().uuid("Invalid property"),
  guest_id: z.string().uuid("Invalid guest"),
  channel: z.enum(CHANNEL_VALUES).default("direct"),
  channel_ref: z.string().max(100).optional(),
  check_in_date: dateString,
  check_out_date: dateString,
  num_guests: z.coerce.number().int().min(1).max(50),
  num_adults: z.coerce.number().int().min(1).max(50).default(1),
  num_children: z.coerce.number().int().min(0).max(20).default(0),
  status: z.enum(RESERVATION_STATUS_VALUES).default("pending"),
  payment_status: z.enum(PAYMENT_STATUS_VALUES).default("unpaid"),

  // Pricing inputs in reais — converted to cents in API layer
  base_amount: z.coerce.number().min(0).default(0),
  cleaning_fee: z.coerce.number().min(0).default(0),
  extra_guest_fee: z.coerce.number().min(0).default(0),
  discount: z.coerce.number().min(0).default(0),
  platform_fee: z.coerce.number().min(0).default(0),
  tax: z.coerce.number().min(0).default(0),

  special_requests: z.string().max(2000).optional(),
  internal_notes: z.string().max(2000).optional(),
};

export const reservationSchema = z
  .object(baseReservationFields)
  .refine((d) => d.check_out_date > d.check_in_date, {
    message: "Check-out must be after check-in",
    path: ["check_out_date"],
  })
  .refine((d) => d.num_adults + d.num_children === d.num_guests, {
    message: "Adults + children must equal total guests",
    path: ["num_guests"],
  });

export type ReservationInput = z.infer<typeof reservationSchema>;

// Update schema — looser, no refines so partial works
export const reservationUpdateSchema = z.object(baseReservationFields).partial();
export type ReservationUpdateInput = z.infer<typeof reservationUpdateSchema>;

// Status transition payload
export const statusTransitionSchema = z.object({
  status: z.enum(RESERVATION_STATUS_VALUES),
  cancellation_reason: z.string().max(500).optional(),
});
export type StatusTransitionInput = z.infer<typeof statusTransitionSchema>;

// Availability check payload
export const availabilityCheckSchema = z.object({
  property_id: z.string().uuid(),
  check_in_date: dateString,
  check_out_date: dateString,
  exclude_reservation_id: z.string().uuid().optional(),
});
export type AvailabilityCheckInput = z.infer<typeof availabilityCheckSchema>;

// Helper: compute totals (in cents) from input. Mirrors logic to keep client + server consistent.
export function calculateReservationTotals(input: {
  base_amount_cents: number;
  cleaning_fee_cents: number;
  extra_guest_fee_cents: number;
  discount_cents: number;
  platform_fee_cents: number;
  tax_cents: number;
}) {
  const subtotal_cents =
    input.base_amount_cents +
    input.cleaning_fee_cents +
    input.extra_guest_fee_cents -
    input.discount_cents;
  const total_cents = subtotal_cents + input.tax_cents;
  const net_amount_cents = total_cents - input.platform_fee_cents;
  return { subtotal_cents, total_cents, net_amount_cents };
}
