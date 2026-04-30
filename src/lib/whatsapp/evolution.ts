/**
 * Evolution API client (thin wrapper).
 * Docs: https://doc.evolution-api.com/
 *
 * We send text + media outbound. Inbound arrives via n8n → /api/webhooks/whatsapp/inbound.
 * uazapi is interface-compatible at this level — swap implementations behind one shared signature.
 */

interface EvolutionConfig {
  baseUrl: string;
  apiKey: string;
  instance: string;
}

function getConfig(overrideInstance?: string): EvolutionConfig {
  const baseUrl = process.env.EVOLUTION_API_URL;
  const apiKey = process.env.EVOLUTION_API_KEY;
  const instance = overrideInstance || process.env.EVOLUTION_DEFAULT_INSTANCE;
  if (!baseUrl || !apiKey || !instance) {
    throw new Error("Evolution API not configured (EVOLUTION_API_URL / EVOLUTION_API_KEY / EVOLUTION_DEFAULT_INSTANCE)");
  }
  return { baseUrl: baseUrl.replace(/\/+$/, ""), apiKey, instance };
}

/** Strip Brazil-specific prefixes etc. and return a digits-only Evolution-style number (E.164 without "+"). */
export function normalizePhone(input: string): string {
  return input.replace(/[^0-9]/g, "");
}

export interface SendTextResult {
  external_id?: string;
  raw: unknown;
}

export async function sendText(
  toPhone: string,
  text: string,
  instance?: string
): Promise<SendTextResult> {
  const cfg = getConfig(instance);
  const number = normalizePhone(toPhone);
  const res = await fetch(`${cfg.baseUrl}/message/sendText/${cfg.instance}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: cfg.apiKey,
    },
    body: JSON.stringify({ number, text }),
  });
  const raw = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`Evolution sendText failed: HTTP ${res.status} — ${JSON.stringify(raw).slice(0, 300)}`);
  }
  const id = (raw as { key?: { id?: string } })?.key?.id;
  return { external_id: id, raw };
}

export async function sendMedia(
  toPhone: string,
  url: string,
  mimeType: string,
  caption?: string,
  fileName?: string,
  instance?: string
): Promise<SendTextResult> {
  const cfg = getConfig(instance);
  const number = normalizePhone(toPhone);
  const mediaType = mimeType.startsWith("image/")
    ? "image"
    : mimeType.startsWith("video/")
    ? "video"
    : mimeType.startsWith("audio/")
    ? "audio"
    : "document";
  const res = await fetch(`${cfg.baseUrl}/message/sendMedia/${cfg.instance}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: cfg.apiKey,
    },
    body: JSON.stringify({
      number,
      mediatype: mediaType,
      mimetype: mimeType,
      caption: caption || "",
      media: url,
      fileName: fileName || "file",
    }),
  });
  const raw = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`Evolution sendMedia failed: HTTP ${res.status} — ${JSON.stringify(raw).slice(0, 300)}`);
  }
  const id = (raw as { key?: { id?: string } })?.key?.id;
  return { external_id: id, raw };
}
