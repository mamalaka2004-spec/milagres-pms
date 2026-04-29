import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/database";

type GuestRow = Database["public"]["Tables"]["guests"]["Row"];

// Manual insert/update types — Database["..."]["Insert"] is too strict and
// breaks PostgREST chained calls; this mirrors the pattern used in owners.ts.
type GuestInsert = {
  company_id: string;
  full_name: string;
  email?: string | null;
  phone?: string | null;
  document_number?: string | null;
  document_type?: "cpf" | "rg" | "passport" | "id_card" | "other" | null;
  date_of_birth?: string | null;
  nationality?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  language?: string;
  notes?: string | null;
  tags?: string[] | null;
  is_vip?: boolean;
  total_stays?: number;
  total_spent_cents?: number;
};
type GuestUpdate = Partial<GuestInsert>;

export interface GuestFilters {
  search?: string;
  is_vip?: boolean;
}

export async function getGuests(companyId: string, filters: GuestFilters = {}) {
  const supabase = createAdminClient();

  let query = supabase
    .from("guests")
    .select("*")
    .eq("company_id", companyId)
    .order("full_name");

  if (filters.search) {
    const term = filters.search.replace(/[%,]/g, "");
    query = query.or(
      `full_name.ilike.%${term}%,email.ilike.%${term}%,phone.ilike.%${term}%`
    );
  }

  if (filters.is_vip !== undefined) {
    query = query.eq("is_vip", filters.is_vip);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data as GuestRow[];
}

export type GuestWithReservations = GuestRow & {
  reservations: Array<{
    id: string;
    booking_code: string;
    status:
      | "inquiry"
      | "pending"
      | "confirmed"
      | "checked_in"
      | "checked_out"
      | "canceled"
      | "no_show";
    payment_status: "unpaid" | "partially_paid" | "paid" | "refunded";
    channel: string;
    check_in_date: string;
    check_out_date: string;
    nights: number;
    total_cents: number;
    property: { id: string; name: string; code: string } | null;
  }>;
};

export async function getGuestById(id: string): Promise<GuestWithReservations> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("guests")
    .select(`
      *,
      reservations (
        id, booking_code, status, payment_status, channel,
        check_in_date, check_out_date, nights, total_cents,
        property:properties (id, name, code)
      )
    `)
    .eq("id", id)
    .single();
  if (error) throw error;
  return data as unknown as GuestWithReservations;
}

export async function findGuestByEmailOrPhone(
  companyId: string,
  email?: string | null,
  phone?: string | null
) {
  if (!email && !phone) return null;
  const supabase = createAdminClient();
  const filters: string[] = [];
  if (email) filters.push(`email.eq.${email}`);
  if (phone) filters.push(`phone.eq.${phone}`);
  const { data, error } = await supabase
    .from("guests")
    .select("*")
    .eq("company_id", companyId)
    .or(filters.join(","))
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data as GuestRow | null;
}

export async function createGuest(data: GuestInsert) {
  const supabase = createAdminClient();
  const { data: guest, error } = await (supabase.from("guests") as any) // eslint-disable-line @typescript-eslint/no-explicit-any
    .insert(data)
    .select()
    .single();
  if (error) throw error;
  return guest as GuestRow;
}

export async function updateGuest(id: string, data: GuestUpdate) {
  const supabase = createAdminClient();
  const { data: guest, error } = await (supabase.from("guests") as any) // eslint-disable-line @typescript-eslint/no-explicit-any
    .update(data)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return guest as GuestRow;
}

export async function recomputeGuestStats(guestId: string) {
  const supabase = createAdminClient();
  const { data: stats, error: statsError } = await supabase
    .from("reservations")
    .select("total_cents, status")
    .eq("guest_id", guestId)
    .in("status", ["confirmed", "checked_in", "checked_out"]);
  if (statsError) throw statsError;

  const rows = (stats as Array<{ total_cents: number; status: string }>) || [];
  const total_stays = rows.length;
  const total_spent_cents = rows.reduce((sum, r) => sum + (r.total_cents || 0), 0);

  const { error } = await (supabase.from("guests") as any) // eslint-disable-line @typescript-eslint/no-explicit-any
    .update({ total_stays, total_spent_cents })
    .eq("id", guestId);
  if (error) throw error;
  return { total_stays, total_spent_cents };
}
