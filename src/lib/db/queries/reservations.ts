import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/database";

type ReservationRow = Database["public"]["Tables"]["reservations"]["Row"];
type ReservationStatus = Database["public"]["Tables"]["reservations"]["Row"]["status"];
type Channel = Database["public"]["Tables"]["reservations"]["Row"]["channel"];
type PaymentStatus = Database["public"]["Tables"]["reservations"]["Row"]["payment_status"];

export interface ReservationFilters {
  status?: string;
  property_id?: string;
  guest_id?: string;
  channel?: string;
  // ISO dates — overlap-style filter: reservations that overlap the window
  from_date?: string;
  to_date?: string;
  search?: string; // booking_code or guest name
}

export interface CreateReservationInput {
  company_id: string;
  property_id: string;
  guest_id: string;
  booking_code: string;
  channel: Channel;
  channel_ref?: string | null;
  check_in_date: string;
  check_out_date: string;
  num_guests: number;
  num_adults: number;
  num_children: number;
  status: ReservationStatus;
  payment_status: PaymentStatus;
  base_amount_cents: number;
  cleaning_fee_cents: number;
  extra_guest_fee_cents: number;
  discount_cents: number;
  subtotal_cents: number;
  platform_fee_cents: number;
  tax_cents: number;
  total_cents: number;
  net_amount_cents: number;
  special_requests?: string | null;
  internal_notes?: string | null;
  created_by?: string | null;
}

const RESERVATION_LIST_SELECT = `
  id, booking_code, status, payment_status, channel, channel_ref,
  check_in_date, check_out_date, nights, num_guests, num_adults, num_children,
  base_amount_cents, cleaning_fee_cents, extra_guest_fee_cents, discount_cents,
  subtotal_cents, platform_fee_cents, tax_cents, total_cents, net_amount_cents,
  canceled_at, confirmed_at, checked_in_at, checked_out_at, cancellation_reason,
  special_requests, internal_notes, created_at, updated_at,
  property:properties (id, name, code, slug, cover_image_url),
  guest:guests (id, full_name, email, phone, is_vip)
`;

export type ReservationListItem = {
  id: string;
  booking_code: string;
  status: ReservationStatus;
  payment_status: PaymentStatus;
  channel: Channel;
  channel_ref: string | null;
  check_in_date: string;
  check_out_date: string;
  nights: number;
  num_guests: number;
  num_adults: number;
  num_children: number;
  base_amount_cents: number;
  cleaning_fee_cents: number;
  extra_guest_fee_cents: number;
  discount_cents: number;
  subtotal_cents: number;
  platform_fee_cents: number;
  tax_cents: number;
  total_cents: number;
  net_amount_cents: number;
  canceled_at: string | null;
  confirmed_at: string | null;
  checked_in_at: string | null;
  checked_out_at: string | null;
  cancellation_reason: string | null;
  special_requests: string | null;
  internal_notes: string | null;
  created_at: string;
  updated_at: string;
  property: { id: string; name: string; code: string; slug: string; cover_image_url: string | null } | null;
  guest: { id: string; full_name: string; email: string | null; phone: string | null; is_vip: boolean } | null;
};

export async function getReservations(
  companyId: string,
  filters: ReservationFilters = {}
): Promise<ReservationListItem[]> {
  const supabase = createAdminClient();

  let query = supabase
    .from("reservations")
    .select(RESERVATION_LIST_SELECT)
    .eq("company_id", companyId)
    .order("check_in_date", { ascending: false });

  if (filters.status) query = query.eq("status", filters.status);
  if (filters.property_id) query = query.eq("property_id", filters.property_id);
  if (filters.guest_id) query = query.eq("guest_id", filters.guest_id);
  if (filters.channel) query = query.eq("channel", filters.channel);
  if (filters.from_date) query = query.gte("check_out_date", filters.from_date);
  if (filters.to_date) query = query.lte("check_in_date", filters.to_date);

  if (filters.search) {
    const term = filters.search.replace(/[%,()*_:]/g, "").slice(0, 80);
    if (term.length > 0) {
      query = query.ilike("booking_code", `%${term}%`);
    }
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data as unknown as ReservationListItem[]) || [];
}

export type ReservationWithDetails = ReservationRow & {
  property: {
    id: string;
    name: string;
    code: string;
    slug: string;
    cover_image_url: string | null;
    max_guests: number;
    check_in_time: string;
    check_out_time: string;
  } | null;
  guest: {
    id: string;
    full_name: string;
    email: string | null;
    phone: string | null;
    document_number: string | null;
    document_type: string | null;
    is_vip: boolean;
    total_stays: number;
    total_spent_cents: number;
  } | null;
  reservation_guests: Array<{
    id: string;
    full_name: string;
    email: string | null;
    phone: string | null;
    document_number: string | null;
    is_primary: boolean;
  }>;
  payments: Array<{
    id: string;
    amount_cents: number;
    method: string;
    status: string;
    reference: string | null;
    paid_at: string | null;
    notes: string | null;
    created_at: string;
  }>;
};

export async function getReservationById(id: string): Promise<ReservationWithDetails> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("reservations")
    .select(`
      *,
      property:properties (id, name, code, slug, cover_image_url, max_guests, check_in_time, check_out_time),
      guest:guests (id, full_name, email, phone, document_number, document_type, is_vip, total_stays, total_spent_cents),
      reservation_guests (id, full_name, email, phone, document_number, is_primary),
      payments (id, amount_cents, method, status, reference, paid_at, notes, created_at)
    `)
    .eq("id", id)
    .single();
  if (error) throw error;
  return data as unknown as ReservationWithDetails;
}

export async function checkAvailability(params: {
  property_id: string;
  check_in_date: string;
  check_out_date: string;
  exclude_reservation_id?: string;
}) {
  const supabase = createAdminClient();

  // Conflicting reservations
  let query = supabase
    .from("reservations")
    .select("id, booking_code, check_in_date, check_out_date, status")
    .eq("property_id", params.property_id)
    .not("status", "in", "(canceled,no_show)")
    .lt("check_in_date", params.check_out_date)
    .gt("check_out_date", params.check_in_date);
  if (params.exclude_reservation_id) {
    query = query.neq("id", params.exclude_reservation_id);
  }
  const { data: conflicts, error: cErr } = await query;
  if (cErr) throw cErr;

  // Conflicting blocked dates
  const { data: blocks, error: bErr } = await supabase
    .from("blocked_dates")
    .select("id, start_date, end_date, reason")
    .eq("property_id", params.property_id)
    .lt("start_date", params.check_out_date)
    .gt("end_date", params.check_in_date);
  if (bErr) throw bErr;

  return {
    available: (conflicts?.length || 0) === 0 && (blocks?.length || 0) === 0,
    conflicting_reservations: conflicts || [],
    conflicting_blocks: blocks || [],
  };
}

export async function getNextBookingSequence(
  companyId: string,
  prefix: string,
  year: number
) {
  const supabase = createAdminClient();
  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;
  const { count, error } = await supabase
    .from("reservations")
    .select("id", { count: "exact", head: true })
    .eq("company_id", companyId)
    .gte("created_at", yearStart)
    .lte("created_at", `${yearEnd}T23:59:59Z`)
    .like("booking_code", `${prefix}-${year}-%`);
  if (error) throw error;
  return (count || 0) + 1;
}

export async function createReservation(input: CreateReservationInput) {
  const supabase = createAdminClient();
  // nights is auto-set by DB trigger calculate_nights, but the column is NOT NULL CHECK > 0
  // so we provide a placeholder = computed difference
  const ms =
    new Date(input.check_out_date).getTime() -
    new Date(input.check_in_date).getTime();
  const nights = Math.max(1, Math.round(ms / (1000 * 60 * 60 * 24)));

  const { data, error } = await (supabase.from("reservations") as any) // eslint-disable-line @typescript-eslint/no-explicit-any
    .insert({ ...input, nights })
    .select()
    .single();
  if (error) throw error;
  return data as ReservationRow;
}

export async function updateReservation(
  id: string,
  data: Partial<ReservationRow>
) {
  const supabase = createAdminClient();
  const { data: row, error } = await (supabase.from("reservations") as any) // eslint-disable-line @typescript-eslint/no-explicit-any
    .update(data)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return row as ReservationRow;
}

import { VALID_STATUS_TRANSITIONS } from "@/lib/utils/constants";

export function canTransition(
  from: ReservationStatus,
  to: ReservationStatus
): boolean {
  if (from === to) return true;
  return VALID_STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}

export async function transitionReservationStatus(
  id: string,
  next: ReservationStatus,
  opts: { cancellation_reason?: string } = {}
) {
  const supabase = createAdminClient();
  const { data: current, error: getErr } = await supabase
    .from("reservations")
    .select("id, status")
    .eq("id", id)
    .single();
  if (getErr) throw getErr;
  const currentRow = current as { id: string; status: ReservationStatus } | null;
  if (!currentRow) throw new Error("Reservation not found");
  if (!canTransition(currentRow.status, next)) {
    throw new Error(`Cannot transition from ${currentRow.status} to ${next}`);
  }

  const update: Partial<ReservationRow> = { status: next };
  const now = new Date().toISOString();
  if (next === "confirmed") update.confirmed_at = now;
  if (next === "checked_in") update.checked_in_at = now;
  if (next === "checked_out") update.checked_out_at = now;
  if (next === "canceled") {
    update.canceled_at = now;
    if (opts.cancellation_reason) {
      update.cancellation_reason = opts.cancellation_reason;
    }
  }

  const { data, error } = await (supabase.from("reservations") as any) // eslint-disable-line @typescript-eslint/no-explicit-any
    .update(update)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as ReservationRow;
}
