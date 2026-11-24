import { createAdminClient } from "@/lib/supabase/admin";
import { getBase64FromMediaMessage } from "./evolution";
import { isR2Enabled, r2Upload } from "@/lib/storage/r2";

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

/**
 * Store a chat media file and return its public URL. Uses Cloudflare R2 when configured
 * (keeps WhatsApp media off the Supabase Storage quota), otherwise Supabase Storage.
 */
export async function storeChatMedia(
  path: string,
  bytes: Uint8Array | Buffer,
  opts: { contentType: string; upsert?: boolean },
): Promise<{ url: string } | { error: string }> {
  if (isR2Enabled()) {
    try {
      const url = await r2Upload(path, bytes, { contentType: opts.contentType });
      return { url };
    } catch (e) {
      return { error: e instanceof Error ? e.message : "R2 upload failed" };
    }
  }
  const supabase = createAdminClient();
  const { error } = await supabase.storage
    .from(CHAT_MEDIA_BUCKET)
    .upload(path, bytes, { contentType: opts.contentType, cacheControl: "3600", upsert: opts.upsert ?? false });
  if (error) return { error: error.message };
  const { data } = supabase.storage.from(CHAT_MEDIA_BUCKET).getPublicUrl(path);
  return { url: data.publicUrl };
}

export function extForMime(mime: string): string {
  if (EXT_BY_MIME[mime]) return EXT_BY_MIME[mime];
  const sub = (mime.split("/")[1] || "bin").split(";")[0];
  return sub.replace(/[^a-z0-9]/gi, "").slice(0, 5).toLowerCase() || "bin";
}

/**
 * Download an inbound media message from Evolution (decrypted) and re-host it on our
 * public media storage (R2 or Supabase) so it displays in the chat. Returns the public URL + mime + filename,
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

    const stored = await storeChatMedia(path, bytes, { contentType: mime, upsert: true });
    if ("error" in stored) return null;
    return { url: stored.url, mime, fileName: media.fileName };
  } catch {
    return null;
  }
}
