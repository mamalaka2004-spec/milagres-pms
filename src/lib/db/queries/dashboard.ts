import { createAdminClient } from "@/lib/supabase/admin";

export interface DashboardData {
  stats: {
    occupancy_rate: number;
    occupied_units: number;
    active_units: number;
    monthly_revenue_cents: number;
    monthly_revenue_change_pct: number; // vs previous month
    reservations_this_month: number;
    pending_amount_cents: number;
    pending_count: number;
  };
  today_checkins: Array<{
    id: string;
    booking_code: string;
    guest_name: string;
    is_vip: boolean;
    property_name: string;
    nights: number;
    status: string;
  }>;
  today_checkouts: Array<{
    id: string;
    booking_code: string;
    guest_name: string;
    property_name: string;
    cleaning_status: string | null;
  }>;
  recent_reservations: Array<{
    id: string;
    booking_code: string;
    guest_name: string;
    property_name: string;
    check_in_date: string;
    check_out_date: string;
    nights: number;
    total_cents: number;
    status: string;
    payment_status: string;
    channel: string;
  }>;
}

function fmtDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export async function getDashboardData(companyId: string): Promise<DashboardData> {
  const supabase = createAdminClient();
  const today = new Date();
  const todayStr = fmtDate(today);

  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  const prevStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const prevEnd = new Date(today.getFullYear(), today.getMonth(), 0);

  const monthStartStr = fmtDate(monthStart);
  const monthEndStr = fmtDate(monthEnd);
  const prevStartStr = fmtDate(prevStart);
  const prevEndStr = fmtDate(prevEnd);

  // 1. Active properties
  const { data: propsData } = await supabase
    .from("properties")
    .select("id")
    .eq("company_id", companyId)
    .eq("status", "active")
    .is("deleted_at", null);
  const activePropertyIds = new Set(((propsData as Array<{ id: string }>) || []).map((p) => p.id));
  const active_units = activePropertyIds.size;

  // 2. Reservations occupying TODAY (for occupancy calc)
  const { data: occToday } = await supabase
    .from("reservations")
    .select("property_id")
    .eq("company_id", companyId)
    .lte("check_in_date", todayStr)
    .gt("check_out_date", todayStr)
    .in("status", ["confirmed", "checked_in"]);
  const occupiedToday = new Set(
    ((occToday as Array<{ property_id: string }>) || [])
      .filter((r) => activePropertyIds.has(r.property_id))
      .map((r) => r.property_id)
  );
  const occupancy_rate = active_units > 0 ? occupiedToday.size / active_units : 0;

  // 3. Monthly revenue (this + previous)
  const [thisMonthRes, prevMonthRes] = await Promise.all([
    supabase
      .from("reservations")
      .select("total_cents, status")
      .eq("company_id", companyId)
      .lte("check_in_date", monthEndStr)
      .gte("check_out_date", monthStartStr)
      .in("status", ["confirmed", "checked_in", "checked_out"]),
    supabase
      .from("reservations")
      .select("total_cents, status")
      .eq("company_id", companyId)
      .lte("check_in_date", prevEndStr)
      .gte("check_out_date", prevStartStr)
      .in("status", ["confirmed", "checked_in", "checked_out"]),
  ]);
  const thisGross = (((thisMonthRes.data as Array<{ total_cents: number }>) || []).reduce(
    (s, r) => s + (r.total_cents || 0),
    0
  ));
  const prevGross = (((prevMonthRes.data as Array<{ total_cents: number }>) || []).reduce(
    (s, r) => s + (r.total_cents || 0),
    0
  ));
  const monthly_revenue_change_pct =
    prevGross > 0 ? ((thisGross - prevGross) / prevGross) * 100 : 0;

  // 4. Reservations created this month
  const { count: createdThisMonth } = await supabase
    .from("reservations")
    .select("id", { count: "exact", head: true })
    .eq("company_id", companyId)
    .gte("created_at", monthStartStr)
    .lte("created_at", `${monthEndStr}T23:59:59Z`);

  // 5. Pending amounts (unpaid + partially_paid reservations)
  const { data: pendingData } = await supabase
    .from("reservations")
    .select("total_cents, payment_status, id")
    .eq("company_id", companyId)
    .in("payment_status", ["unpaid", "partially_paid"])
    .in("status", ["pending", "confirmed", "checked_in", "checked_out"]);
  const pending = (pendingData as Array<{ total_cents: number; id: string }>) || [];
  const pending_count = pending.length;

  // For each pending reservation, compute paid amount via payments table
  let pending_amount_cents = 0;
  if (pending.length > 0) {
    const ids = pending.map((p) => p.id);
    const { data: paymentsData } = await supabase
      .from("payments")
      .select("reservation_id, amount_cents, status")
      .in("reservation_id", ids)
      .eq("status", "completed");
    const paidByRes = new Map<string, number>();
    for (const pm of (paymentsData as Array<{ reservation_id: string; amount_cents: number }>) || []) {
      paidByRes.set(pm.reservation_id, (paidByRes.get(pm.reservation_id) || 0) + pm.amount_cents);
    }
    for (const r of pending) {
      pending_amount_cents += Math.max(0, r.total_cents - (paidByRes.get(r.id) || 0));
    }
  }

  // 6. Today's check-ins
  const { data: ciData } = await supabase
    .from("reservations")
    .select(`
      id, booking_code, nights, status,
      guest:guests (full_name, is_vip),
      property:properties (name)
    `)
    .eq("company_id", companyId)
    .eq("check_in_date", todayStr)
    .in("status", ["confirmed", "pending"])
    .order("created_at");
  const today_checkins = (((ciData as unknown as Array<{
    id: string;
    booking_code: string;
    nights: number;
    status: string;
    guest: { full_name: string; is_vip: boolean } | null;
    property: { name: string } | null;
  }>) || []).map((r) => ({
    id: r.id,
    booking_code: r.booking_code,
    guest_name: r.guest?.full_name || "—",
    is_vip: r.guest?.is_vip || false,
    property_name: r.property?.name || "—",
    nights: r.nights,
    status: r.status,
  })));

  // 7. Today's check-outs
  const { data: coData } = await supabase
    .from("reservations")
    .select(`
      id, booking_code,
      guest:guests (full_name),
      property:properties (id, name),
      housekeeping_tasks (status)
    `)
    .eq("company_id", companyId)
    .eq("check_out_date", todayStr)
    .in("status", ["confirmed", "checked_in", "checked_out"]);
  const today_checkouts = (((coData as unknown as Array<{
    id: string;
    booking_code: string;
    guest: { full_name: string } | null;
    property: { id: string; name: string } | null;
    housekeeping_tasks: Array<{ status: string }>;
  }>) || []).map((r) => ({
    id: r.id,
    booking_code: r.booking_code,
    guest_name: r.guest?.full_name || "—",
    property_name: r.property?.name || "—",
    cleaning_status: r.housekeeping_tasks?.[0]?.status || null,
  })));

  // 8. Recent reservations (last 5)
  const { data: rrData } = await supabase
    .from("reservations")
    .select(`
      id, booking_code, check_in_date, check_out_date, nights, total_cents, status, payment_status, channel,
      guest:guests (full_name),
      property:properties (name)
    `)
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
    .limit(5);
  const recent_reservations = (((rrData as unknown as Array<{
    id: string;
    booking_code: string;
    check_in_date: string;
    check_out_date: string;
    nights: number;
    total_cents: number;
    status: string;
    payment_status: string;
    channel: string;
    guest: { full_name: string } | null;
    property: { name: string } | null;
  }>) || []).map((r) => ({
    id: r.id,
    booking_code: r.booking_code,
    guest_name: r.guest?.full_name || "—",
    property_name: r.property?.name || "—",
    check_in_date: r.check_in_date,
    check_out_date: r.check_out_date,
    nights: r.nights,
    total_cents: r.total_cents,
    status: r.status,
    payment_status: r.payment_status,
    channel: r.channel,
  })));

  return {
    stats: {
      occupancy_rate,
      occupied_units: occupiedToday.size,
      active_units,
      monthly_revenue_cents: thisGross,
      monthly_revenue_change_pct,
      reservations_this_month: createdThisMonth || 0,
      pending_amount_cents,
      pending_count,
    },
    today_checkins,
    today_checkouts,
    recent_reservations,
  };
}
