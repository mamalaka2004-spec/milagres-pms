/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from "@/lib/supabase/admin";
import { getCashFlow } from "@/lib/db/queries/fin";
import type { CashFlowMonth } from "@/types/finance";

export interface DashboardFinance {
  /** Mês corrente (a partir do fluxo de caixa financeiro — transações pagas). */
  revenue_month_cents: number;
  expense_month_cents: number;
  net_month_cents: number;
  /** Saldo somado de todas as contas bancárias. */
  total_balance_cents: number;
  /** A receber (pendente) e vencido a receber. */
  pending_in_cents: number;
  overdue_in_cents: number;
  /** Últimos 6 meses (para o mini-gráfico). */
  months: CashFlowMonth[];
}

export interface DashboardTasks {
  pending: number;
  overdue: number;
  today: number;
}

export interface DashboardChannel {
  channel: string;
  count: number;
  amount_cents: number;
}

export interface DashboardFunnelStage {
  stage_id: string;
  name: string;
  color: string;
  count: number;
  value_cents: number;
}

export interface DashboardFunnel {
  open_count: number;
  open_value_cents: number;
  won_month_count: number;
  won_month_value_cents: number;
  lost_month_count: number;
  /** ganhos / (ganhos + perdidos) no mês, em %. */
  conversion_pct: number;
  by_stage: DashboardFunnelStage[];
  recent_deals: Array<{
    id: string;
    title: string;
    value_cents: number;
    status: string;
    stage_name: string | null;
    created_at: string;
  }>;
}

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
  finance: DashboardFinance;
  tasks: DashboardTasks;
  channels: DashboardChannel[];
  funnel: DashboardFunnel;
}

function fmtDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Métricas de tarefas operacionais (housekeeping_tasks) do mês. */
async function getTasksMetrics(
  supabase: ReturnType<typeof createAdminClient>,
  companyId: string,
  todayStr: string
): Promise<DashboardTasks> {
  const openStatuses = ["pending", "in_progress"];
  const [pendingRes, overdueRes, todayRes] = await Promise.all([
    supabase
      .from("housekeeping_tasks")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId)
      .in("status", openStatuses),
    supabase
      .from("housekeeping_tasks")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId)
      .in("status", openStatuses)
      .lt("due_date", todayStr),
    supabase
      .from("housekeeping_tasks")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId)
      .in("status", openStatuses)
      .eq("due_date", todayStr),
  ]);
  return {
    pending: pendingRes.count || 0,
    overdue: overdueRes.count || 0,
    today: todayRes.count || 0,
  };
}

/** Métricas do funil de Vendas (deals das pipelines type='vendas'). */
async function getFunnelMetrics(
  companyId: string,
  monthStartISO: string
): Promise<DashboardFunnel> {
  const empty: DashboardFunnel = {
    open_count: 0,
    open_value_cents: 0,
    won_month_count: 0,
    won_month_value_cents: 0,
    lost_month_count: 0,
    conversion_pct: 0,
    by_stage: [],
    recent_deals: [],
  };

  const client = createAdminClient();

  const { data: pipelines, error: pErr } = await (client.from("funnel_pipelines") as any)
    .select("id")
    .eq("company_id", companyId)
    .eq("type", "vendas");
  if (pErr) return empty;
  const pipelineIds = ((pipelines as Array<{ id: string }>) || []).map((p) => p.id);
  if (pipelineIds.length === 0) return empty;

  const [stagesRes, dealsRes] = await Promise.all([
    (client.from("funnel_stages") as any)
      .select("id, name, color, sort_order")
      .in("pipeline_id", pipelineIds)
      .order("sort_order", { ascending: true }),
    (client.from("funnel_deals") as any)
      .select("id, title, value, status, stage_id, created_at, updated_at")
      .in("pipeline_id", pipelineIds)
      .limit(5000),
  ]);
  if (dealsRes.error) return empty;

  const stages = (stagesRes.data as Array<{ id: string; name: string; color: string; sort_order: number }>) || [];
  const stageById = new Map(stages.map((s) => [s.id, s]));
  const deals =
    (dealsRes.data as Array<{
      id: string;
      title: string;
      value: number | string;
      status: string;
      stage_id: string | null;
      created_at: string;
      updated_at: string;
    }>) || [];

  const toCents = (v: number | string) => Math.round(Number(v || 0) * 100);

  const byStageMap = new Map<string, DashboardFunnelStage>();
  for (const s of stages) {
    byStageMap.set(s.id, { stage_id: s.id, name: s.name, color: s.color, count: 0, value_cents: 0 });
  }

  const result: DashboardFunnel = { ...empty, by_stage: [], recent_deals: [] };
  for (const d of deals) {
    const cents = toCents(d.value);
    if (d.status === "open") {
      result.open_count += 1;
      result.open_value_cents += cents;
      if (d.stage_id && byStageMap.has(d.stage_id)) {
        const st = byStageMap.get(d.stage_id)!;
        st.count += 1;
        st.value_cents += cents;
      }
    } else if (d.status === "won" && d.updated_at >= monthStartISO) {
      result.won_month_count += 1;
      result.won_month_value_cents += cents;
    } else if (d.status === "lost" && d.updated_at >= monthStartISO) {
      result.lost_month_count += 1;
    }
  }

  const closed = result.won_month_count + result.lost_month_count;
  result.conversion_pct = closed > 0 ? (result.won_month_count / closed) * 100 : 0;
  result.by_stage = Array.from(byStageMap.values());

  result.recent_deals = deals
    .slice()
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
    .slice(0, 5)
    .map((d) => ({
      id: d.id,
      title: d.title,
      value_cents: toCents(d.value),
      status: d.status,
      stage_name: d.stage_id ? stageById.get(d.stage_id)?.name ?? null : null,
      created_at: d.created_at,
    }));

  return result;
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
      .select("total_cents, status, channel")
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
  const thisMonthRows =
    (thisMonthRes.data as Array<{ total_cents: number; channel: string }>) || [];
  const thisGross = thisMonthRows.reduce((s, r) => s + (r.total_cents || 0), 0);

  // 3b. Revenue by channel (this month)
  const channelMap = new Map<string, { count: number; amount_cents: number }>();
  for (const r of thisMonthRows) {
    const key = r.channel || "direct";
    const cur = channelMap.get(key) || { count: 0, amount_cents: 0 };
    cur.count += 1;
    cur.amount_cents += r.total_cents || 0;
    channelMap.set(key, cur);
  }
  const channels: DashboardChannel[] = Array.from(channelMap.entries())
    .map(([channel, v]) => ({ channel, ...v }))
    .sort((a, b) => b.amount_cents - a.amount_cents);
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

  // 9. Finance (fluxo de caixa — últimos 6 meses), tarefas e funil de vendas.
  //    Isolados em try/catch para que uma falha (ex.: migration não aplicada
  //    em algum ambiente) não derrube o dashboard inteiro.
  const monthStartISO = monthStart.toISOString();
  const [cashflow, tasks, funnel] = await Promise.all([
    getCashFlow(companyId, 6).catch(() => null),
    getTasksMetrics(supabase, companyId, todayStr).catch(() => ({ pending: 0, overdue: 0, today: 0 })),
    getFunnelMetrics(companyId, monthStartISO).catch(() => ({
      open_count: 0,
      open_value_cents: 0,
      won_month_count: 0,
      won_month_value_cents: 0,
      lost_month_count: 0,
      conversion_pct: 0,
      by_stage: [],
      recent_deals: [],
    })),
  ]);

  const currentMonthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  const currentCf = cashflow?.months.find((m) => m.month === currentMonthKey);
  const finance: DashboardFinance = {
    revenue_month_cents: currentCf?.revenue_cents || 0,
    expense_month_cents: currentCf?.expense_cents || 0,
    net_month_cents: currentCf?.net_cents || 0,
    total_balance_cents: cashflow?.total_balance_cents || 0,
    pending_in_cents: cashflow?.pending_in_cents || 0,
    overdue_in_cents: cashflow?.overdue_in_cents || 0,
    months: cashflow?.months || [],
  };

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
    finance,
    tasks,
    channels,
    funnel,
  };
}
