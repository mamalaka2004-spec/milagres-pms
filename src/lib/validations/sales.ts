import { z } from "zod";

const stageEnum = z.enum([
  "apresentacao",
  "qualificacao_objetivo",
  "qualificacao_orcamento",
  "apresentacao_imoveis",
  "handoff",
  "encerramento",
]);

export const leadDataPatchSchema = z.object({
  lead_stage: stageEnum.nullable().optional(),
  objetivo: z.string().max(500).nullable().optional(),
  orcamento: z.string().max(120).nullable().optional(),
  confidence_score: z.number().int().min(0).max(10).nullable().optional(),
  reasoning: z.string().max(2000).nullable().optional(),
  property_of_interest: z.string().max(200).nullable().optional(),
  closed_reason: z.string().max(500).nullable().optional(),
});

export const aiControlSchema = z.object({
  action: z.enum(["pause", "resume"]),
});

export const outboundMirrorSchema = z.object({
  line_phone: z.string().regex(/^\+?[0-9]{8,15}$/),
  contact_phone: z.string().regex(/^\+?[0-9]{8,15}$/),
  contact_name: z.string().max(120).nullable().optional(),
  text: z.string().max(8000),
  external_id: z.string().max(120).nullable().optional(),
  // Lead state from the AI agent (Sarah workflow `Milagres Completo`)
  lead_stage: stageEnum.nullable().optional(),
  objetivo: z.string().max(500).nullable().optional(),
  orcamento: z.string().max(120).nullable().optional(),
  confidence_score: z.number().int().min(0).max(10).nullable().optional(),
  reasoning: z.string().max(2000).nullable().optional(),
  origem: z.enum(["inbound", "prospeccao_fria"]).nullable().optional(),
});
