import { createServerClient } from "@/lib/supabase/server";
import { getCalendarData } from "@/lib/db/queries/calendar";
import { listTasks } from "@/lib/db/queries/tasks";
import { getFinanceSummary } from "@/lib/db/queries/finance";
import { getReservations, checkAvailability } from "@/lib/db/queries/reservations";
import { listActivePublicProperties } from "@/lib/db/queries/properties";
import { getDashboardData } from "@/lib/db/queries/dashboard";
import type { AiMode } from "@/types/database";

/** OpenAI tool schema (function calling). Re-using ChatCompletionTool shape. */
export interface ToolDef {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

interface ToolCtx {
  companyId: string;
  mode: AiMode;
}

/**
 * Each tool is a thin async function that takes JSON args and returns a JSON-serializable
 * payload. Keep responses small + structured — tokens cost money.
 */
type ToolHandler = (args: Record<string, unknown>, ctx: ToolCtx) => Promise<unknown>;

/* ─────────────────────── tool implementations ─────────────────────── */

const todaySummary: ToolHandler = async (_args, ctx) => {
  const data = await getDashboardData(ctx.companyId);
  return {
    today: new Date().toISOString().slice(0, 10),
    occupancy: {
      rate_pct: Math.round(data.stats.occupancy_rate * 100),
      occupied: data.stats.occupied_units,
      total: data.stats.active_units,
    },
    revenue_this_month_brl: (data.stats.monthly_revenue_cents / 100).toFixed(2),
    pending_balance_brl: (data.stats.pending_amount_cents / 100).toFixed(2),
    pending_count: data.stats.pending_count,
    checkins_today: data.today_checkins.map((c) => ({
      booking_code: c.booking_code,
      guest: c.guest_name,
      property: c.property_name,
      nights: c.nights,
      status: c.status,
      vip: c.is_vip,
    })),
    checkouts_today: data.today_checkouts.map((c) => ({
      booking_code: c.booking_code,
      guest: c.guest_name,
      property: c.property_name,
      cleaning_status: c.cleaning_status,
    })),
  };
};

const listProperties: ToolHandler = async (args, ctx) => {
  // Public mode: only public-active fields. Operations/management can use richer view if needed.
  const props = await listActivePublicProperties();
  const limit = typeof args.limit === "number" ? args.limit : 20;
  return props.slice(0, limit).map((p) => ({
    name: p.name,
    code: p.code,
    slug: p.slug,
    type: p.type,
    city: p.city,
    max_guests: p.max_guests,
    bedrooms: p.bedrooms,
    beds: p.beds,
    bathrooms: p.bathrooms,
    base_price_brl: p.base_price_cents > 0 ? (p.base_price_cents / 100).toFixed(2) : null,
    cleaning_fee_brl: p.cleaning_fee_cents > 0 ? (p.cleaning_fee_cents / 100).toFixed(2) : null,
    instant_booking: p.instant_booking_enabled,
    public_url: `/p/${p.slug}`,
  }));
  void ctx;
};

const checkAvail: ToolHandler = async (args, ctx) => {
  const propertyCode = args.property_code as string | undefined;
  const slug = args.slug as string | undefined;
  const check_in_date = args.check_in_date as string;
  const check_out_date = args.check_out_date as string;

  if (!check_in_date || !check_out_date) {
    return { error: "check_in_date and check_out_date are required (YYYY-MM-DD)" };
  }

  // Resolve property by code or slug
  const supabase = await createServerClient();
  let propQuery = supabase
    .from("properties")
    .select("id, name, code, slug, max_guests")
    .eq("company_id", ctx.companyId)
    .eq("status", "active")
    .is("deleted_at", null)
    .limit(1);
  if (propertyCode) propQuery = propQuery.eq("code", propertyCode);
  else if (slug) propQuery = propQuery.eq("slug", slug);
  else return { error: "Provide property_code or slug" };

  const { data: prop } = await propQuery.maybeSingle();
  const property = prop as { id: string; name: string; code: string; slug: string; max_guests: number } | null;
  if (!property) return { error: "Property not found" };

  const result = await checkAvailability({
    property_id: property.id,
    check_in_date,
    check_out_date,
  });

  type Conflict = { booking_code: string; check_in_date: string; check_out_date: string; status: string };
  type Block = { start_date: string; end_date: string; reason: string };
  return {
    property: { name: property.name, code: property.code, slug: property.slug },
    period: { check_in_date, check_out_date },
    available: result.available,
    conflicts: (result.conflicting_reservations as unknown as Conflict[]).map((r) => ({
      booking_code: r.booking_code,
      check_in: r.check_in_date,
      check_out: r.check_out_date,
      status: r.status,
    })),
    blocks: (result.conflicting_blocks as unknown as Block[]).map((b) => ({
      start: b.start_date,
      end: b.end_date,
      reason: b.reason,
    })),
  };
};

const searchReservations: ToolHandler = async (args, ctx) => {
  const filters: Parameters<typeof getReservations>[1] = {};
  if (typeof args.status === "string") filters.status = args.status;
  if (typeof args.channel === "string") filters.channel = args.channel;
  if (typeof args.from_date === "string") filters.from_date = args.from_date;
  if (typeof args.to_date === "string") filters.to_date = args.to_date;
  if (typeof args.search === "string") filters.search = args.search;

  const list = await getReservations(ctx.companyId, filters);
  const limit = typeof args.limit === "number" ? args.limit : 20;
  return list.slice(0, limit).map((r) => ({
    booking_code: r.booking_code,
    guest: r.guest?.full_name,
    property: r.property?.name,
    channel: r.channel,
    check_in: r.check_in_date,
    check_out: r.check_out_date,
    nights: r.nights,
    status: r.status,
    payment_status: r.payment_status,
    total_brl: (r.total_cents / 100).toFixed(2),
  }));
};

const calendarRange: ToolHandler = async (args, ctx) => {
  const from = (args.from_date as string) || new Date().toISOString().slice(0, 10);
  const to =
    (args.to_date as string) ||
    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const data = await getCalendarData(ctx.companyId, from, to);
  return {
    period: { from, to },
    properties_count: data.properties.length,
    reservations: data.reservations.map((r) => ({
      booking_code: r.booking_code,
      guest: r.guest_name,
      property_id: r.property_id,
      check_in: r.check_in_date,
      check_out: r.check_out_date,
      status: r.status,
      channel: r.channel,
    })),
    blocks: data.blocks.map((b) => ({
      property_id: b.property_id,
      start: b.start_date,
      end: b.end_date,
      source: b.external_source,
    })),
  };
};

const tasksToday: ToolHandler = async (args, ctx) => {
  const today = new Date().toISOString().slice(0, 10);
  const filters: Parameters<typeof listTasks>[1] = {};
  if (typeof args.status === "string") filters.status = args.status as never;

  const [todayTasks, overdueTasks] = await Promise.all([
    listTasks(ctx.companyId, { ...filters, from: today, to: today }),
    listTasks(ctx.companyId, { overdue_before: today }),
  ]);
  return {
    today: todayTasks.map((t) => ({
      type: t.type,
      priority: t.priority,
      status: t.status,
      property: t.property?.name,
      reservation: t.reservation?.booking_code,
      due_time: t.due_time,
      assignee: t.assignee?.full_name || null,
    })),
    overdue: overdueTasks.map((t) => ({
      type: t.type,
      priority: t.priority,
      status: t.status,
      property: t.property?.name,
      due_date: t.due_date,
    })),
  };
};

const financeSummary: ToolHandler = async (args, ctx) => {
  if (ctx.mode === "guest") return { error: "Finance data is not available for guests" };
  const today = new Date();
  const defaultFrom = new Date(today.getFullYear(), today.getMonth() - 5, 1)
    .toISOString()
    .slice(0, 10);
  const defaultTo = new Date(today.getFullYear(), today.getMonth() + 1, 0)
    .toISOString()
    .slice(0, 10);
  const from = (args.from_date as string) || defaultFrom;
  const to = (args.to_date as string) || defaultTo;

  const summary = await getFinanceSummary(ctx.companyId, from, to);
  return {
    period: summary.period,
    gross_revenue_brl: (summary.gross_revenue_cents / 100).toFixed(2),
    net_revenue_brl: (summary.net_cents / 100).toFixed(2),
    occupancy_pct: Math.round(summary.occupancy_rate * 100),
    reservations: summary.reservations_count,
    by_channel: summary.by_channel.map((c) => ({
      channel: c.channel,
      count: c.count,
      amount_brl: (c.amount_cents / 100).toFixed(2),
    })),
    by_property: summary.by_property.map((p) => ({
      name: p.name,
      count: p.count,
      amount_brl: (p.amount_cents / 100).toFixed(2),
    })),
    monthly: summary.monthly.map((m) => ({
      month: m.month,
      gross_brl: (m.gross_cents / 100).toFixed(2),
      net_brl: (m.net_cents / 100).toFixed(2),
    })),
  };
};

/* ─────────────────────── registries (mode-scoped) ─────────────────────── */

const HANDLERS: Record<string, ToolHandler> = {
  today_summary: todaySummary,
  list_properties: listProperties,
  check_availability: checkAvail,
  search_reservations: searchReservations,
  calendar_range: calendarRange,
  tasks_today: tasksToday,
  finance_summary: financeSummary,
};

const TOOL_DEFS: Record<string, ToolDef> = {
  today_summary: {
    type: "function",
    function: {
      name: "today_summary",
      description:
        "Resumo de hoje: ocupação, receita do mês, check-ins/outs do dia, balance pendente. Use para perguntas como 'o que tem hoje?' ou 'como está a operação?'.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  list_properties: {
    type: "function",
    function: {
      name: "list_properties",
      description: "Lista propriedades ativas (públicas) com nome, capacidade, preço base. Use quando o usuário perguntar quais propriedades existem ou quer comparar opções.",
      parameters: {
        type: "object",
        properties: {
          limit: { type: "number", description: "max results (default 20)" },
        },
      },
    },
  },
  check_availability: {
    type: "function",
    function: {
      name: "check_availability",
      description:
        "Verifica se uma propriedade está disponível em um período. Forneça property_code (ex: MIL-AB-CASAPISCINA) OU slug.",
      parameters: {
        type: "object",
        properties: {
          property_code: { type: "string" },
          slug: { type: "string" },
          check_in_date: { type: "string", description: "YYYY-MM-DD" },
          check_out_date: { type: "string", description: "YYYY-MM-DD" },
        },
        required: ["check_in_date", "check_out_date"],
      },
    },
  },
  search_reservations: {
    type: "function",
    function: {
      name: "search_reservations",
      description:
        "Busca reservas filtradas por status, canal, datas ou booking_code. Use para 'quais reservas estão pendentes', 'reservas para abril', 'reserva MIL-2026-0001'.",
      parameters: {
        type: "object",
        properties: {
          status: {
            type: "string",
            enum: ["inquiry", "pending", "confirmed", "checked_in", "checked_out", "canceled", "no_show"],
          },
          channel: {
            type: "string",
            enum: ["direct", "airbnb", "booking", "expedia", "vrbo", "manual", "other"],
          },
          from_date: { type: "string", description: "YYYY-MM-DD — reservations checking out on or after" },
          to_date: { type: "string", description: "YYYY-MM-DD — reservations checking in on or before" },
          search: { type: "string", description: "booking code substring" },
          limit: { type: "number" },
        },
      },
    },
  },
  calendar_range: {
    type: "function",
    function: {
      name: "calendar_range",
      description:
        "Reservas + bloqueios de calendário (incluindo Airbnb/Booking sync) em um período.",
      parameters: {
        type: "object",
        properties: {
          from_date: { type: "string", description: "YYYY-MM-DD (default = today)" },
          to_date: { type: "string", description: "YYYY-MM-DD (default = today + 30d)" },
        },
      },
    },
  },
  tasks_today: {
    type: "function",
    function: {
      name: "tasks_today",
      description:
        "Tarefas de housekeeping com vencimento hoje + tarefas atrasadas (overdue). Use para 'o que tem para fazer hoje', 'tarefas pendentes'.",
      parameters: { type: "object", properties: {} },
    },
  },
  finance_summary: {
    type: "function",
    function: {
      name: "finance_summary",
      description:
        "Resumo financeiro: receita bruta, líquida, ocupação, breakdown por canal e por propriedade. Apenas operations/management.",
      parameters: {
        type: "object",
        properties: {
          from_date: { type: "string", description: "YYYY-MM-DD (default = início de 6 meses atrás)" },
          to_date: { type: "string", description: "YYYY-MM-DD (default = fim do mês corrente)" },
        },
      },
    },
  },
};

const MODE_TOOLS: Record<AiMode, string[]> = {
  guest: ["list_properties", "check_availability"],
  operations: [
    "today_summary",
    "list_properties",
    "check_availability",
    "search_reservations",
    "calendar_range",
    "tasks_today",
  ],
  management: [
    "today_summary",
    "list_properties",
    "search_reservations",
    "calendar_range",
    "finance_summary",
  ],
};

export function getToolsForMode(mode: AiMode): ToolDef[] {
  return MODE_TOOLS[mode].map((n) => TOOL_DEFS[n]);
}

export async function dispatchTool(
  name: string,
  rawArgs: string,
  ctx: ToolCtx
): Promise<unknown> {
  const handler = HANDLERS[name];
  if (!handler) return { error: `Unknown tool: ${name}` };

  let args: Record<string, unknown> = {};
  if (rawArgs && rawArgs.trim().length > 0) {
    try {
      args = JSON.parse(rawArgs);
    } catch {
      return { error: "Invalid JSON arguments" };
    }
  }

  // Mode gate: deny tools not in this mode's whitelist
  if (!MODE_TOOLS[ctx.mode].includes(name)) {
    return { error: `Tool '${name}' not available in mode '${ctx.mode}'` };
  }

  try {
    return await handler(args, ctx);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Tool failed" };
  }
}
