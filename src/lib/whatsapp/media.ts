import { createAdminClient } from "@/lib/supabase/admin";
import { getBase64FromMediaMessage } from "./evolution";

export const CHAT_MEDIA_BUCKET = "whatsapp-media";

const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "audio/ogg": "ogg",
  "audio/mpeg": "mp3",
  "audio/mp4": "m4a",
  "audio/webm": "webm",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/3gpp": "3gp",
  "application/pdf": "pdf",
};

export function extForMime(mime: string): string {
  if (EXT_BY_MIME[mime]) return EXT_BY_MIME[mime];
  const sub = (mime.split("/")[1] || "bin").split(";")[0];
  return sub.replace(/[^a-z0-9]/gi, "").slice(0, 5).toLowerCase() || "bin";
}

/**
 * Download an inbound media message from Evolution (decrypted) and re-host it on our
 * public bucket so it displays in the chat. Returns the public URL + mime + filename,
 * or null on failure (caller keeps the original — non-displayable — URL as a fallback).
 */
export async function rehostInboundMedia(opts: {
  externalId: string;
  conversationId: string;
  instance?: string;
  apiKey?: string;
}): Promise<{ url: string; mime: string; fileName: string | null } | null> {
  try {
    const media = await getBase64FromMediaMessage(opts.externalId, opts.instance, opts.apiKey);
    const bytes = Buffer.from(media.base64, "base64");
    if (bytes.length === 0) return null;
    // Strip codec params (e.g. "audio/ogg; codecs=opus") — storage matches the base type.
    const mime = (media.mimetype.split(";")[0] || "application/octet-stream").trim();
    const ext = extForMime(mime);
    const safeId = opts.externalId.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 40) || `${Date.now()}`;
    const path = `inbound/${opts.conversationId}/${safeId}.${ext}`;

    const supabase = createAdminClient();
    const { error } = await supabase.storage
      .from(CHAT_MEDIA_BUCKET)
      .upload(path, bytes, { contentType: mime, cacheControl: "3600", upsert: true });
    if (error) return null;

    const { data } = supabase.storage.from(CHAT_MEDIA_BUCKET).getPublicUrl(path);
    return { url: data.publicUrl, mime, fileName: media.fileName };
  } catch {
    return null;
  }
}
