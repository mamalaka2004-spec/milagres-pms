import { z } from "zod";

export const funnelTypeEnum = z.enum(["locacao", "vendas"]);
const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Cor inválida (use #RRGGBB)");

// ─── Pipelines ───
export const pipelineCreateSchema = z.object({
  type: funnelTypeEnum,
  name: z.string().min(2, "Nome obrigatório").max(60),
  color: hexColor.default("#c9a84c"),
  is_default: z.boolean().optional(),
});
export const pipelineUpdateSchema = z.object({
  name: z.string().min(2).max(60).optional(),
  color: hexColor.optional(),
  is_default: z.boolean().optional(),
  active: z.boolean().optional(),
  sort_order: z.number().int().optional(),
});

// ─── Stages ───
export const stageCreateSchema = z.object({
  pipeline_id: z.string().uuid(),
  name: z.string().min(1, "Nome obrigatório").max(40),
  color: hexColor.default("#94a3b8"),
  is_won: z.boolean().optional(),
  is_lost: z.boolean().optional(),
});
export const stageUpdateSchema = z.object({
  name: z.string().min(1).max(40).optional(),
  color: hexColor.optional(),
  is_won: z.boolean().optional(),
  is_lost: z.boolean().optional(),
  sort_order: z.number().int().optional(),
});
export const stageReorderSchema = z.object({
  pipeline_id: z.string().uuid(),
  ordered_ids: z.array(z.string().uuid()).min(1),
});

// ─── Tags ───
export const tagCreateSchema = z.object({
  type: funnelTypeEnum,
  name: z.string().min(1, "Nome obrigatório").max(40),
  color: hexColor.default("#94a3b8"),
});
export const tagUpdateSchema = z.object({
  name: z.string().min(1).max(40).optional(),
  color: hexColor.optional(),
  sort_order: z.number().int().optional(),
});

// ─── Deals ───
export const dealCreateSchema = z.object({
  pipeline_id: z.string().uuid(),
  stage_id: z.string().uuid(),
  title: z.string().min(1, "Título obrigatório").max(120),
  value: z.coerce.number().min(0).default(0),
  currency: z.string().max(3).default("BRL"),
  conversation_id: z.string().uuid().nullable().optional(),
  contact_id: z.string().uuid().nullable().optional(),
  property_id: z.string().uuid().nullable().optional(),
  expected_close_date: z.string().nullable().optional(),
  owner_id: z.string().uuid().nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});
export const dealUpdateSchema = z.object({
  stage_id: z.string().uuid().optional(),
  sort_order: z.number().int().optional(),
  title: z.string().min(1).max(120).optional(),
  value: z.coerce.number().min(0).optional(),
  currency: z.string().max(3).optional(),
  contact_id: z.string().uuid().nullable().optional(),
  property_id: z.string().uuid().nullable().optional(),
  conversation_id: z.string().uuid().nullable().optional(),
  expected_close_date: z.string().nullable().optional(),
  owner_id: z.string().uuid().nullable().optional(),
  status: z.enum(["open", "won", "lost"]).optional(),
  lost_reason: z.string().max(500).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

/** Mover card: aceita a coluna virtual (cria o deal a partir de uma conversa). */
export const dealMoveSchema = z.object({
  stage_id: z.string().uuid(),
  sort_order: z.number().int().optional(),
  // usado só quando o card é virtual (conversa sem negócio)
  conversation_id: z.string().uuid().nullable().optional(),
  title: z.string().max(120).optional(),
});

// ─── Tag sets (M2M) ───
export const setTagsSchema = z.object({
  tag_ids: z.array(z.string().uuid()),
});

export type PipelineCreate = z.infer<typeof pipelineCreateSchema>;
export type StageCreate = z.infer<typeof stageCreateSchema>;
export type TagCreate = z.infer<typeof tagCreateSchema>;
export type DealCreate = z.infer<typeof dealCreateSchema>;
