import { z } from "zod";
import { ALL_TOOL_NAMES } from "@/types/ai-agent";

const providerEnum = z.enum(["openai", "anthropic", "google", "custom"]);
const executionEnum = z.enum(["api_route", "n8n"]);
const knowledgeSourceEnum = z.enum(["tools", "manual", "none"]);

const faqEntrySchema = z.object({
  q: z.string().min(1).max(500),
  a: z.string().min(1).max(4000),
});

// Aceita só nomes de ferramentas conhecidos (evita lixo no array).
const toolsSchema = z.array(z.enum(ALL_TOOL_NAMES as [string, ...string[]])).max(ALL_TOOL_NAMES.length);

const businessHoursSchema = z
  .record(
    z.string(),
    z
      .object({ open: z.string(), close: z.string() })
      .nullable()
  )
  .nullable();

export const agentCreateSchema = z.object({
  name: z.string().min(2, "Nome obrigatório").max(80),
  description: z.string().max(280).nullable().optional(),
  active: z.boolean().optional(),
  system_prompt: z.string().max(20000).default(""),
  provider: providerEnum.default("openai"),
  model: z.string().min(1).max(80).default("gpt-4o-mini"),
  temperature: z.coerce.number().min(0).max(2).default(0.4),
  max_tokens: z.coerce.number().int().positive().max(32000).nullable().optional(),
  top_p: z.coerce.number().min(0).max(1).default(1),
  tools: toolsSchema.default([]),
  knowledge_source: knowledgeSourceEnum.default("tools"),
  knowledge_urls: z.array(z.string().url().max(500)).max(50).default([]),
  faq: z.array(faqEntrySchema).max(100).default([]),
  business_hours: businessHoursSchema.optional(),
  fallback_human: z.boolean().default(true),
  handoff_keywords: z
    .array(z.string().min(1).max(60))
    .max(30)
    .default(["falar com humano", "atendente", "falar com atendente", "quero um humano", "pessoa real"]),
  execution: executionEnum.default("api_route"),
  n8n_url: z.string().url().max(500).nullable().optional(),
  history_limit: z.coerce.number().int().min(1).max(100).default(20),
  // min(1): 0 loops desativaria a geração silenciosamente (nenhuma chamada ao LLM).
  max_tool_loops: z.coerce.number().int().min(1).max(10).default(3),
});

// Update = tudo opcional (sem defaults, pra permitir patch parcial).
export const agentUpdateSchema = z.object({
  name: z.string().min(2).max(80).optional(),
  description: z.string().max(280).nullable().optional(),
  active: z.boolean().optional(),
  system_prompt: z.string().max(20000).optional(),
  provider: providerEnum.optional(),
  model: z.string().min(1).max(80).optional(),
  temperature: z.coerce.number().min(0).max(2).optional(),
  max_tokens: z.coerce.number().int().positive().max(32000).nullable().optional(),
  top_p: z.coerce.number().min(0).max(1).optional(),
  tools: toolsSchema.optional(),
  knowledge_source: knowledgeSourceEnum.optional(),
  knowledge_urls: z.array(z.string().url().max(500)).max(50).optional(),
  faq: z.array(faqEntrySchema).max(100).optional(),
  business_hours: businessHoursSchema.optional(),
  fallback_human: z.boolean().optional(),
  handoff_keywords: z.array(z.string().min(1).max(60)).max(30).optional(),
  execution: executionEnum.optional(),
  n8n_url: z.string().url().max(500).nullable().optional(),
  history_limit: z.coerce.number().int().min(1).max(100).optional(),
  max_tool_loops: z.coerce.number().int().min(1).max(10).optional(),
});

// Vincular agente a um canal (linha) OU a uma feature. Exatamente um dos dois.
export const bindingSetSchema = z
  .object({
    agent_id: z.string().uuid(),
    line_id: z.string().uuid().nullable().optional(),
    feature: z.string().min(1).max(60).nullable().optional(),
  })
  .refine(
    (v) => (v.line_id ? !v.feature : !!v.feature),
    { message: "Informe line_id OU feature (exatamente um)." }
  );

export const bindingDeleteSchema = z
  .object({
    line_id: z.string().uuid().nullable().optional(),
    feature: z.string().min(1).max(60).nullable().optional(),
  })
  .refine((v) => (v.line_id ? !v.feature : !!v.feature), {
    message: "Informe line_id OU feature (exatamente um).",
  });

export type AgentCreate = z.infer<typeof agentCreateSchema>;
export type AgentUpdate = z.infer<typeof agentUpdateSchema>;
export type BindingSet = z.infer<typeof bindingSetSchema>;
