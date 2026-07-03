import { z } from "zod";

// ─── Grupos de anúncios ──────────────────────────────────────────────────────
export const propertyGroupSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório").max(80),
  description: z.string().max(500).optional().nullable(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Cor inválida").default("#7c9070"),
});
export type PropertyGroupInput = z.infer<typeof propertyGroupSchema>;

export const groupMembersSchema = z.object({
  property_ids: z.array(z.string().uuid()).max(500),
});
export type GroupMembersInput = z.infer<typeof groupMembersSchema>;

// ─── Feriados ────────────────────────────────────────────────────────────────
export const holidaySchema = z.object({
  name: z.string().min(1, "Nome é obrigatório").max(80),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida"),
  recurring: z.boolean().default(false),
});
export type HolidayInput = z.infer<typeof holidaySchema>;

// ─── Regras de preço ─────────────────────────────────────────────────────────
const ruleBase = z.object({
  name: z.string().min(1, "Nome é obrigatório").max(120),
  kind: z.enum(["season", "recurring", "holiday"]),
  target_type: z.enum(["all", "group", "property"]).default("all"),
  group_id: z.string().uuid().optional().nullable(),
  property_id: z.string().uuid().optional().nullable(),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  days_of_week: z.array(z.number().int().min(0).max(6)).optional().nullable(),
  adjustment_type: z.enum(["set", "percent"]),
  // valores em R$ no formulário; a rota converte para cents
  price: z.coerce.number().min(0).optional().nullable(),
  percent: z.coerce.number().gt(-100, "Deve ser maior que -100%").max(1000).optional().nullable(),
  min_nights: z.coerce.number().int().min(1).max(365).optional().nullable(),
  priority: z.coerce.number().int().min(0).max(1000).default(0),
  active: z.boolean().default(true),
});

export const pricingRuleSchema = ruleBase.superRefine((data, ctx) => {
  if (data.target_type === "group" && !data.group_id) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["group_id"], message: "Selecione o grupo" });
  }
  if (data.target_type === "property" && !data.property_id) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["property_id"], message: "Selecione o imóvel" });
  }
  if (data.kind === "season") {
    if (!data.start_date || !data.end_date) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["start_date"], message: "Informe o período da temporada" });
    } else if (data.start_date > data.end_date) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["end_date"], message: "Fim deve ser após o início" });
    }
  }
  if (data.kind === "recurring" && (!data.days_of_week || data.days_of_week.length === 0)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["days_of_week"], message: "Selecione ao menos um dia" });
  }
  if (data.adjustment_type === "set" && (data.price == null || data.price <= 0)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["price"], message: "Informe o preço da noite" });
  }
  if (data.adjustment_type === "percent" && data.percent == null) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["percent"], message: "Informe o percentual" });
  }
});
export type PricingRuleInput = z.infer<typeof pricingRuleSchema>;

// ─── Quote / calendário ──────────────────────────────────────────────────────
export const quoteQuerySchema = z.object({
  property_id: z.string().uuid(),
  check_in: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  check_out: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
}).refine((d) => d.check_in < d.check_out, { message: "Check-out deve ser após o check-in" });

export const calendarQuerySchema = z.object({
  property_id: z.string().uuid(),
  month: z.string().regex(/^\d{4}-\d{2}$/, "Use o formato YYYY-MM"),
});

// ─── Aplicar tarifa sugerida (lote) ──────────────────────────────────────────
export const applySuggestionSchema = z.object({
  mode: z.enum(["base", "season"]),
  items: z.array(z.object({
    property_id: z.string().uuid(),
    price_cents: z.number().int().min(100, "Preço muito baixo"),
  })).min(1, "Selecione ao menos um imóvel").max(200),
  season_name: z.string().max(120).optional(),
  season_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  season_end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
}).superRefine((data, ctx) => {
  if (data.mode === "season") {
    if (!data.season_start || !data.season_end) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["season_start"], message: "Informe o período da temporada" });
    } else if (data.season_start > data.season_end) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["season_end"], message: "Fim deve ser após o início" });
    }
  }
});
export type ApplySuggestionInput = z.infer<typeof applySuggestionSchema>;
