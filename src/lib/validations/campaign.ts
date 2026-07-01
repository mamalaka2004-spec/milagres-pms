import { z } from "zod";

export const campaignCreateSchema = z.object({
  name: z.string().min(2, "Nome obrigatório").max(120),
  line_id: z.string().uuid().nullable().optional(),
  message_template: z.string().min(1, "Mensagem obrigatória").max(4000),
  media_url: z.string().url().nullable().optional(),
  media_mime_type: z.string().max(120).nullable().optional(),
  throttle_seconds: z.number().int().min(1).max(600).optional(),
  target_pipeline_id: z.string().uuid().nullable().optional(),
  target_stage_id: z.string().uuid().nullable().optional(),
  scheduled_at: z.string().nullable().optional(),
});

export const campaignUpdateSchema = campaignCreateSchema.partial();

/** Adicionar destinatários: por contatos do fonebook e/ou telefones manuais. */
export const addRecipientsSchema = z.object({
  contact_ids: z.array(z.string().uuid()).optional(),
  phones: z
    .array(z.object({ phone: z.string().min(8).max(20), name: z.string().max(120).optional() }))
    .optional(),
});

export const sendCampaignSchema = z.object({
  scheduled_at: z.string().nullable().optional(), // presente = agenda; ausente/null = envia agora
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

export type CampaignCreate = z.infer<typeof campaignCreateSchema>;
export type AddRecipients = z.infer<typeof addRecipientsSchema>;
