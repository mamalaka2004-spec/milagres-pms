import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/auth";
import {
  apiSuccess,
  apiError,
  apiUnauthorized,
  apiServerError,
} from "@/lib/api/response";

export const maxDuration = 30;

// WhatsApp media ceiling is 16 MB.
const MAX_BYTES = 16 * 1024 * 1024;

// Documents accepted in addition to image/* audio/* video/* (matched by exact MIME).
const DOC_MIME = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "text/csv",
]);

function extFor(name: string, mime: string): string {
  const fromName = (name.split(".").pop() || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  if (fromName && fromName.length <= 5) return fromName;
  // fall back to a sensible extension from the mime subtype
  const sub = mime.split("/")[1] || "bin";
  return sub.replace(/[^a-z0-9]/g, "").slice(0, 5) || "bin";
}

/**
 * Chat media upload — for the WhatsApp composer (image / audio / video / document).
 * Stores in the public bucket so Evolution can fetch the URL when sending. Returns
 * { url, mime, name } which the client then posts to the messages endpoint as media_url.
 */
export async function POST(request: NextRequest) {
  try {
    await requireAuth();

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file) return apiError("Nenhum arquivo enviado", 400);
    if (file.size > MAX_BYTES) return apiError("Arquivo muito grande. Máximo 16MB.", 400);

    // Strip codec params (e.g. "audio/webm;codecs=opus") — Storage matches the base
    // MIME type against the bucket allowlist and rejects anything with a codec suffix.
    const mime = (file.type || "application/octet-stream").split(";")[0].trim();
    const ok =
      mime.startsWith("image/") ||
      mime.startsWith("audio/") ||
      mime.startsWith("video/") ||
      DOC_MIME.has(mime);
    if (!ok) return apiError("Tipo de arquivo não suportado", 400);

    const bytes = new Uint8Array(await file.arrayBuffer());
    const ext = extFor(file.name || "", mime);
    const path = `outbound/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`;

    const supabase = createAdminClient();
    const { error: uploadError } = await supabase.storage
      .from("whatsapp-media")
      .upload(path, bytes, { contentType: mime, cacheControl: "3600", upsert: false });
    if (uploadError) return apiError(`Falha no upload: ${uploadError.message}`, 500);

    const { data: { publicUrl } } = supabase.storage.from("whatsapp-media").getPublicUrl(path);
    return apiSuccess({ url: publicUrl, mime, name: file.name || `arquivo.${ext}` });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    return apiServerError(error);
  }
}
