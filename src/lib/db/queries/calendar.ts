import { createAdminClient } from "@/lib/supabase/admin";
import type {
  ReservationStatus,
  PaymentStatus,
  Channel,
} from "@/types/database";

export interface CalendarReservation {
  id: string;
  property_id: string;
  booking_code: string;
  status: ReservationStatus;
  payment_status: PaymentStatus;
  channel: Channel;
  check_in_date: string;
  check_out_date: string;
  nights: number;
  guest_name: string;
  is_vip: boolean;
}

export interface CalendarBlock {
  id: string;
  property_id: string;
  start_date: string;
  end_date: string;
  reason: string | null;
  external_source: "airbnb" | "booking" | "manual" | null;
  external_summary: string | null;
}

export interface CalendarPropertyRow {
  id: string;
  name: string;
  code: string;
  status: "active" | "inactive" | "maintenance";
  cover_image_url: string | null;
}

export interface CalendarData {
  properties: CalendarPropertyRow[];
  reservations: CalendarReservation[];
  blocks: CalendarBlock[];
}

/**
 * Load reservations + blocks overlapping a date window for all properties of the company.
 * `from`/`to` are inclusive on the day side (we filter for any range that overlaps the window).
 */
export async function getCalendarData(
  companyId: string,
  from: string,
  to: string
): Promise<CalendarData> {
  const supabase = createAdminClient();

  const propsP = supabase
    .from("properties")
    .select("id, name, code, status, cover_image_url")
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .order("name");

  const resP = supabase
    .from("reservations")
    .select(`
      id, property_id, booking_code, status, payment_status, channel,
      check_in_date, check_out_date, nights,
      guest:guests (full_name, is_vip)
    `)
    .eq("company_id", companyId)
    .lte("check_in_date", to)
    .gte("check_out_date", from)
    .not("status", "in", "(canceled,no_show)");

  const blocksP = supabase
    .from("blocked_dates")
    .select("id, property_id, start_date, end_date, reason, external_source, external_summary")
    .lt("start_date", to)
    .gt("end_date", from);

  const [{ data: props, error: pErr }, { data: res, error: rErr }, { data: blocks, error: bErr }] =
    await Promise.all([propsP, resP, blocksP]);

  if (pErr) throw pErr;
  if (rErr) throw rErr;
  if (bErr) throw bErr;

  const properties = (props as unknown as CalendarPropertyRow[]) || [];
  const reservations = ((res as unknown as Array<
    Omit<CalendarReservation, "guest_name" | "is_vip"> & {
      guest: { full_name: string; is_vip: boolean } | null;
    }
  >) || []).map((r) => ({
    id: r.id,
    property_id: r.property_id,
    booking_code: r.booking_code,
    status: r.status,
    payment_status: r.payment_status,
    channel: r.channel,
    check_in_date: r.check_in_date,
    check_out_date: r.check_out_date,
    nights: r.nights,
    guest_name: r.guest?.full_name || "—",
    is_vip: r.guest?.is_vip || false,
  }));

  // Filter blocks to company's properties (RLS handles it but we double-check)
  const propIds = new Set(properties.map((p) => p.id));
  const filteredBlocks = ((blocks as unknown as CalendarBlock[]) || []).filter((b) =>
    propIds.has(b.property_id)
  );

  return { properties, reservations, blocks: filteredBlocks };
}
