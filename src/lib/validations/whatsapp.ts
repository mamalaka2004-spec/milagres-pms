import { z } from "zod";

const E164 = /^\+?[0-9]{8,15}$/;

export const lineCreateSchema = z.object({
  phone: z.string().regex(E164, "Phone must be E.164 (digits, optionally + prefix)"),
  label: z.string().min(1).max(40),
  purpose: z.enum(["booking", "sales", "other"]),
  provider: z.enum(["evolution", "uazapi"]).default("evolution"),
  provider_instance: z.string().max(80).optional(),
  ai_enabled: z.boolean().default(false),
  business_hours: z
    .record(
      z.enum(["mon", "tue", "wed", "thu", "fri", "sat", "sun"]),
      z
        .object({
          open: z.string().regex(/^[0-2][0-9]:[0-5][0-9]$/),
          close: z.string().regex(/^[0-2][0-9]:[0-5][0-9]$/),
        })
        .nullable()
    )
    .optional(),
});

export const conversationPatchSchema = z.object({
  status: z.enum(["open", "snoozed", "closed"]).optional(),
  pinned: z.boolean().optional(),
  ai_active: z.boolean().optional(),
  guest_id: z.string().uuid().nullable().optional(),
  reservation_id: z.string().uuid().nullable().optional(),
  contact_name: z.string().max(120).nullable().optional(),
});

export const messageSendSchema = z.object({
  text: z.string().min(1).max(4000).optional(),
  media_url: z.string().url().optional(),
  media_mime_type: z.string().max(80).optional(),
  file_name: z.string().max(200).optional(),
  reply_to_id: z.string().uuid().optional(),
}).refine((d) => !!d.text || !!d.media_url, "Either text or media_url is required");

export const inboundWebhookSchema = z.object({
  line_phone: z.string().regex(E164),
  contact_phone: z.string().regex(E164),
  contact_name: z.string().max(120).optional().nullable(),
  text: z.string().max(8000).optional().nullable(),
  message_type: z.enum(["text", "image", "audio", "video", "document", "note", "status"]).default("text"),
  media_url: z.string().url().optional().nullable(),
  media_mime_type: z.string().max(80).optional().nullable(),
  file_name: z.string().max(200).optional().nullable(),
  external_id: z.string().max(120).optional().nullable(),
  timestamp: z.string().datetime().optional(),
});
