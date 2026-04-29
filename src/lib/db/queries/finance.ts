import { createAdminClient } from "@/lib/supabase/admin";

export type EntryType = "revenue" | "expense" | "commission" | "payout" | "tax" | "refund";

export interface FinancialEntryRow {
  id: string;
  company_id: string;
  reservation_id: string | null;
  property_id: string | null;
  type: EntryType;
  category: string | null;
  description: string | null;
  amount_cents: number;
  date: string;
  created_by: string | null;
  created_at: string;
}

export interface CreateEntryInput {
  company_id: string;
  reservation_id?: string | null;
  property_id?: string | null;
  type: EntryType;
  category?: string | null;
  description?: string | null;
  amount_cents: number;
  date: string;
  created_by?: string | null;
}

export async function listEntries(
  companyId: string,
  filters: { from?: string; to?: string; type?: EntryType; property_id?: string } = {}
) {
  const supabase = createAdminClient();
  let query = supabase
    .from("financial_entries")
    .select(`
      *,
      reservation:reservations (id, booking_code),
      property:properties (id, name, code)
    `)
    .eq("company_id", companyId)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false });
  if (filters.from) query = query.gte("date", filters.from);
  if (filters.to) query = query.lte("date", filters.to);
  if (filters.type) query = query.eq("type", filters.type);
  if (filters.property_id) query = query.eq("property_id", filters.property_id);

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function createEntry(input: CreateEntryInput): Promise<FinancialEntryRow> {
  const supabase = createAdminClient();
  const { data, error } = await (supabase.from("financial_entries") as any) // eslint-disable-line @typescript-eslint/no-explicit-any
    .insert(input)
    .select()
    .single();
  if (error) throw error;
  return data as FinancialEntryRow;
}

export interface FinanceSummary {
  period: { from: string; to: string };
  gross_revenue_cents: number;
  refunds_cents: number;
  expenses_cents: number;
  commissions_cents: number;
  payouts_cents: number;
  taxes_cents: number;
  net_cents: number;
  reservations_count: number;
  occupancy_rate: number; // 0–1
  by_channel: Array<{ channel: string; amount_cents: number; count: number }>;
  by_property: Array<{ property_id: string; name: string; amount_cents: number; count: number }>;
  monthly: Array<{ month: string; gross_cents: number; net_cents: number }>;
}

export async function getFinanceSummary(
  companyId: string,
  from: string,
  to: string
): Promise<FinanceSummary> {
  const supabase = createAdminClient();

  // 1. Reservations checked-in/out in the window are "earned" revenue.
  //    For simpler MVP we treat all confirmed/checked_*/checked_out reservations
  //    overlapping the window as contributing to gross revenue.
  const { data: resData, error: rErr } = await supabase
    .from("reservations")
    .select(`
      id, total_cents, net_amount_cents, platform_fee_cents, channel,
      check_in_date, check_out_date, status,
      property:properties (id, name)
    `)
    .eq("company_id", companyId)
    .lte("check_in_date", to)
    .gte("check_out_date", from)
    .in("status", ["confirmed", "checked_in", "checked_out"]);
  if (rErr) throw rErr;
  const reservations = (resData as unknown as Array<{
    id: string;
    total_cents: number;
    net_amount_cents: number;
    platform_fee_cents: number;
    channel: string;
    check_in_date: string;
    check_out_date: string;
    status: string;
    property: { id: string; name: string } | null;
  }>) || [];

  const gross = reservations.reduce((s, r) => s + (r.total_cents || 0), 0);
  const platformFees = reservations.reduce((s, r) => s + (r.platform_fee_cents || 0), 0);

  // 2. Financial entries in window
  const { data: entriesData, error: eErr } = await supabase
    .from("financial_entries")
    .select("type, amount_cents")
    .eq("company_id", companyId)
    .gte("date", from)
    .lte("date", to);
  if (eErr) throw eErr;
  const entries = (entriesData as Array<{ type: EntryType; amount_cents: number }>) || [];

  const sumOf = (t: EntryType) =>
    entries.filter((e) => e.type === t).reduce((s, e) => s + e.amount_cents, 0);

  const expenses_cents = sumOf("expense");
  const commissions_cents = sumOf("commission");
  const payouts_cents = sumOf("payout");
  const taxes_cents = sumOf("tax");
  const refunds_cents = sumOf("refund");
  const net_cents = gross - platformFees - expenses_cents - commissions_cents - taxes_cents - refunds_cents;

  // 3. By-channel aggregation
  const byChannelMap = new Map<string, { amount_cents: number; count: number }>();
  for (const r of reservations) {
    const cur = byChannelMap.get(r.channel) || { amount_cents: 0, count: 0 };
    cur.amount_cents += r.total_cents;
    cur.count += 1;
    byChannelMap.set(r.channel, cur);
  }
  const by_channel = Array.from(byChannelMap.entries())
    .map(([channel, v]) => ({ channel, ...v }))
    .sort((a, b) => b.amount_cents - a.amount_cents);

  // 4. By-property
  const byPropertyMap = new Map<string, { name: string; amount_cents: number; count: number }>();
  for (const r of reservations) {
    if (!r.property) continue;
    const cur = byPropertyMap.get(r.property.id) || {
      name: r.property.name,
      amount_cents: 0,
      count: 0,
    };
    cur.amount_cents += r.total_cents;
    cur.count += 1;
    byPropertyMap.set(r.property.id, cur);
  }
  const by_property = Array.from(byPropertyMap.entries())
    .map(([property_id, v]) => ({ property_id, ...v }))
    .sort((a, b) => b.amount_cents - a.amount_cents);

  // 5. Monthly breakdown
  const monthlyMap = new Map<string, { gross_cents: number; net_cents: number }>();
  for (const r of reservations) {
    const month = r.check_in_date.slice(0, 7);
    const cur = monthlyMap.get(month) || { gross_cents: 0, net_cents: 0 };
    cur.gross_cents += r.total_cents;
    cur.net_cents += r.net_amount_cents;
    monthlyMap.set(month, cur);
  }
  const monthly = Array.from(monthlyMap.entries())
    .map(([month, v]) => ({ month, ...v }))
    .sort((a, b) => a.month.localeCompare(b.month));

  // 6. Occupancy: nights booked / nights available across active properties
  const { count: activePropsCount } = await supabase
    .from("properties")
    .select("id", { count: "exact", head: true })
    .eq("company_id", companyId)
    .eq("status", "active")
    .is("deleted_at", null);

  const fromMs = new Date(from + "T00:00:00Z").getTime();
  const toMs = new Date(to + "T00:00:00Z").getTime();
  const totalDaysInWindow = Math.max(1, Math.round((toMs - fromMs) / (24 * 60 * 60 * 1000)) + 1);
  const totalNightsAvailable = (activePropsCount || 0) * totalDaysInWindow;
  const totalNightsBooked = reservations.reduce((s, r) => {
    const ci = new Date(Math.max(new Date(r.check_in_date).getTime(), fromMs));
    const co = new Date(Math.min(new Date(r.check_out_date).getTime(), toMs + 24 * 60 * 60 * 1000));
    const nights = Math.max(0, Math.round((co.getTime() - ci.getTime()) / (24 * 60 * 60 * 1000)));
    return s + nights;
  }, 0);
  const occupancy_rate =
    totalNightsAvailable > 0 ? Math.min(1, totalNightsBooked / totalNightsAvailable) : 0;

  return {
    period: { from, to },
    gross_revenue_cents: gross,
    refunds_cents,
    expenses_cents,
    commissions_cents,
    payouts_cents,
    taxes_cents,
    net_cents,
    reservations_count: reservations.length,
    occupancy_rate,
    by_channel,
    by_property,
    monthly,
  };
}
