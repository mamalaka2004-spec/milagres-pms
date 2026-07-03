import { z } from "zod";

// ─── Guias de imóveis (property_guides) ────────────────────────────────────
const nullableStr = (max: number) => z.string().max(max).nullable().optional();

export const guideCreateSchema = z.object({
  unit_code: z.string().min(1, "Código da unidade obrigatório").max(80),
  name: z.string().min(1, "Nome obrigatório").max(120),
  property_id: z.string().uuid().nullable().optional(),
  property_type: nullableStr(60),
  condo: nullableStr(120),
  region: nullableStr(120),
  max_guests: z.coerce.number().int().min(0).max(100).nullable().optional(),
  suites: z.coerce.number().int().min(0).max(100).nullable().optional(),
  beds: nullableStr(120),
  bathrooms: nullableStr(120),
  short_description: nullableStr(500),
  description: nullableStr(8000),
  amenities: z.array(z.string().max(120)).max(100).optional(),
  house_rules: z.array(z.string().max(200)).max(100).optional(),
  check_in_time: z.string().max(10).optional(),
  check_out_time: z.string().max(10).optional(),
  cancellation_policy: nullableStr(2000),
  // Privados (Wi-Fi / acesso) — só liberados a hóspede confirmado em runtime.
  wifi_ssid: nullableStr(120),
  wifi_password: nullableStr(120),
  access_method: nullableStr(60),
  door_code: nullableStr(60),
  access_instructions: nullableStr(2000),
  exact_address: nullableStr(300),
  maps_url: nullableStr(500),
  // Mídia (URLs vindas do upload)
  pdf_path: nullableStr(500),
  image_urls: z.array(z.string().max(700)).max(60).optional(),
  video_urls: z.array(z.string().max(700)).max(30).optional(),
  active: z.boolean().optional(),
});

// Update: parcial. Mesmos campos, todos opcionais (unit_code/name ainda validam formato).
export const guideUpdateSchema = guideCreateSchema.partial();

// ─── Artigos / FAQ (kb_articles) ───────────────────────────────────────────
export const articleCreateSchema = z.object({
  scope: z.enum(["region", "unit", "company"]).default("region"),
  category: z.string().min(1, "Categoria obrigatória").max(60),
  title: z.string().min(1, "Título obrigatório").max(200),
  content: z.string().max(20000).nullable().optional(),
  data: z.any().nullable().optional(),
  visibility: z.enum(["public", "confirmed_guest"]).default("public"),
  tags: z.array(z.string().max(60)).max(40).optional(),
  sort_order: z.coerce.number().int().optional(),
  active: z.boolean().optional(),
  property_guide_id: z.string().uuid().nullable().optional(),
});

export const articleUpdateSchema = articleCreateSchema.partial();

export type GuideCreate = z.infer<typeof guideCreateSchema>;
export type GuideUpdate = z.infer<typeof guideUpdateSchema>;
export type ArticleCreate = z.infer<typeof articleCreateSchema>;
export type ArticleUpdate = z.infer<typeof articleUpdateSchema>;

// ─── Upload ────────────────────────────────────────────────────────────────
export const UPLOAD_KINDS = ["image", "video", "pdf"] as const;
export type UploadKind = (typeof UPLOAD_KINDS)[number];

export const UPLOAD_MIME: Record<UploadKind, string[]> = {
  image: ["image/jpeg", "image/png", "image/webp", "image/gif"],
  video: ["video/mp4", "video/webm", "video/quicktime"],
  pdf: ["application/pdf"],
};
export const UPLOAD_MAX_BYTES: Record<UploadKind, number> = {
  image: 10 * 1024 * 1024, // 10MB
  video: 100 * 1024 * 1024, // 100MB
  pdf: 75 * 1024 * 1024, // 75MB
};
