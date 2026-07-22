import { z } from "zod";

/** Janela de envio (dias 0=dom…6=sáb, horários locais do timezone). */
export const campaignScheduleSchema = z.object({
  timezone: z.string().min(3).max(60).default("America/Sao_Paulo"),
  days: z.array(z.number().int().min(0).max(6)).min(1).default([1, 2, 3, 4, 5, 6]),
  start_time: z.string().regex(/^[0-2][0-9]:[0-5][0-9]$/).default("09:00"),
  end_time: z.string().regex(/^[0-2][0-9]:[0-5][0-9]$/).default("19:00"),
});

export const campaignCreateSchema = z.object({
  name: z.string().min(2, "Nome obrigatório").max(120),
  line_id: z.string().uuid().nullable().optional(),
  message_template: z.string().min(1, "Mensagem obrigatória").max(4000),
  media_url: z.string().url().nullable().optional(),
  media_mime_type: z.string().max(120).nullable().optional(),
  /** @deprecated — o motor usa min/max_interval_seconds. */
  throttle_seconds: z.number().int().min(1).max(600).optional(),
  target_pipeline_id: z.string().uuid().nullable().optional(),
  target_stage_id: z.string().uuid().nullable().optional(),
  scheduled_at: z.string().nullable().optional(),
  // ── Antiban (036) ──
  min_interval_seconds: z.number().int().min(10).max(3600).optional(),
  max_interval_seconds: z.number().int().min(10).max(7200).optional(),
  daily_limit: z.number().int().min(1).max(1000).optional(),
  hourly_limit: z.number().int().min(1).max(200).optional(),
  schedule: campaignScheduleSchema.optional(),
  simulate_typing: z.boolean().optional(),
  typing_seconds_min: z.number().int().min(1).max(10).optional(),
  typing_seconds_max: z.number().int().min(1).max(15).optional(),
  opt_out_keywords: z.array(z.string().min(2).max(40)).max(20).optional(),
  skip_active_conversations: z.boolean().optional(),
  /** Listas salvas como audiência (resolvidas no enqueue). */
  audience: z.object({ list_ids: z.array(z.string().uuid()) }).nullable().optional(),
});

export const campaignUpdateSchema = campaignCreateSchema.partial();

/** Passo da cadência: template fixo (vars+spintax) OU gerado por IA. */
export const campaignStepSchema = z
  .object({
    kind: z.enum(["template", "ai"]),
    body: z.string().max(4000).nullable().optional(),
    ai_prompt: z.string().max(2000).nullable().optional(),
    media_url: z.string().url().nullable().optional(),
    media_mime_type: z.string().max(120).nullable().optional(),
    wait_hours: z.number().min(0).max(24 * 30).default(0),
    variant: z.string().max(4).default("A"),
  })
  .refine(
    (s) =>
      (s.kind === "template" && (!!s.body?.trim() || !!s.media_url)) ||
      (s.kind === "ai" && !!s.ai_prompt?.trim()),
    "Passo template precisa de mensagem ou mídia; passo IA precisa de instrução"
  );

export const campaignStepsReplaceSchema = z.object({
  steps: z.array(campaignStepSchema).min(1, "Ao menos 1 passo").max(10),
});

/** Adicionar destinatários: por contatos do fonebook e/ou telefones manuais. */
export const addRecipientsSchema = z.object({
  contact_ids: z.array(z.string().uuid()).optional(),
  phones: z
    .array(z.object({ phone: z.string().min(8).max(20), name: z.string().max(120).optional() }))
    .optional(),
});

export const sendCampaignSchema = z.object({
  scheduled_at: z.string().nullable().optional(), // presente = agenda; ausente/null = envia agora
  list_ids: z.array(z.string().uuid()).optional(), // listas salvas como audiência extra
});

/** Pausar/retomar/cancelar uma campanha. */
export const campaignControlSchema = z.object({
  action: z.enum(["pause", "resume", "cancel"]),
});

/** Callback do n8n (autenticado por header x-webhook-secret). */
export const campaignStatusCallbackSchema = z.object({
  campaign_id: z.string().uuid(),
  recipient_id: z.string().uuid(),
  status: z.enum(["sending", "sent", "delivered", "failed", "skipped"]),
  external_id: z.string().max(200).nullable().optional(),
  error: z.string().max(1000).nullable().optional(),
});

/** Prospecção cross-base: joga contatos numa etapa de funil (cria deals). */
export const prospectSchema = z.object({
  pipeline_id: z.string().uuid(),
  stage_id: z.string().uuid(),
  contact_ids: z.array(z.string().uuid()).min(1, "Selecione ao menos 1 contato"),
});

// ─── Listas de contatos (036) ──────────────────────────────────────────────
export const contactListCreateSchema = z.object({
  name: z.string().min(2, "Nome obrigatório").max(120),
  description: z.string().max(500).nullable().optional(),
});

export const contactListUpdateSchema = contactListCreateSchema.partial();

/** Adicionar/remover membros em lote. */
export const contactListMembersSchema = z.object({
  contact_ids: z.array(z.string().uuid()).min(1, "Selecione ao menos 1 contato"),
});

/** Marcar/desmarcar "não contatar" (opt-out manual, LGPD). */
export const contactDoNotContactSchema = z.object({
  do_not_contact: z.boolean(),
});

export type CampaignCreate = z.infer<typeof campaignCreateSchema>;
export type AddRecipients = z.infer<typeof addRecipientsSchema>;
export type ContactListCreate = z.infer<typeof contactListCreateSchema>;
