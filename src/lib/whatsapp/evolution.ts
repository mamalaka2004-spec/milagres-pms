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

/* ─────────────────────── Backfill helpers ─────────────────────── */

export interface EvoChatSummary {
  remoteJid: string;     // "5511988887777@s.whatsapp.net"
  pushName?: string | null;
  unreadMessages?: number;
  lastMessageTimestamp?: number;
}

export interface EvoMessage {
  key: { id: string; remoteJid: string; fromMe: boolean };
  message?: Record<string, unknown> | null;
  messageType?: string;
  messageTimestamp?: number | string;
  pushName?: string | null;
}

/** List chats for an Evolution instance. */
export async function findChats(instance?: string): Promise<EvoChatSummary[]> {
  const cfg = getConfig(instance);
  const res = await fetch(`${cfg.baseUrl}/chat/findChats/${cfg.instance}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: cfg.apiKey },
    body: JSON.stringify({}),
  });
  const raw = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`Evolution findChats HTTP ${res.status}: ${JSON.stringify(raw).slice(0, 300)}`);
  // Evolution returns either an array of chats directly, or {chats: [...]}.
  const list = Array.isArray(raw) ? raw : (raw as { chats?: EvoChatSummary[] })?.chats || [];
  return list as EvoChatSummary[];
}

/** List messages for a specific contact (remoteJid) within an instance. */
export async function findMessages(remoteJid: string, instance?: string, limit = 200): Promise<EvoMessage[]> {
  const cfg = getConfig(instance);
  const res = await fetch(`${cfg.baseUrl}/chat/findMessages/${cfg.instance}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: cfg.apiKey },
    body: JSON.stringify({
      where: { key: { remoteJid } },
      limit,
    }),
  });
  const raw = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`Evolution findMessages HTTP ${res.status}: ${JSON.stringify(raw).slice(0, 300)}`);
  // Evolution v1.x: {messages: {records: [...], total, ...}}; v2: {records: [...]}; or array.
  if (Array.isArray(raw)) return raw as EvoMessage[];
  const wrapped = raw as { messages?: { records?: EvoMessage[] }; records?: EvoMessage[] };
  if (wrapped?.messages?.records) return wrapped.messages.records;
  if (wrapped?.records) return wrapped.records;
  return [];
}

/** Detect message type + extract text/media from an Evolution message envelope. */
export function decodeMessage(m: EvoMessage): {
  text: string | null;
  messageType: "text" | "image" | "audio" | "video" | "document" | "note" | "status";
  mediaMimeType: string | null;
  fileName: string | null;
} {
  const msg = (m.message || {}) as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  if (msg.conversation) return { text: msg.conversation, messageType: "text", mediaMimeType: null, fileName: null };
  if (msg.extendedTextMessage?.text) return { text: msg.extendedTextMessage.text, messageType: "text", mediaMimeType: null, fileName: null };
  if (msg.ephemeralMessage?.message?.conversation) return { text: msg.ephemeralMessage.message.conversation, messageType: "text", mediaMimeType: null, fileName: null };
  if (msg.ephemeralMessage?.message?.extendedTextMessage?.text) return { text: msg.ephemeralMessage.message.extendedTextMessage.text, messageType: "text", mediaMimeType: null, fileName: null };
  if (msg.imageMessage) return { text: msg.imageMessage.caption || null, messageType: "image", mediaMimeType: msg.imageMessage.mimetype || "image/jpeg", fileName: null };
  if (msg.audioMessage) return { text: null, messageType: "audio", mediaMimeType: msg.audioMessage.mimetype || "audio/ogg", fileName: null };
  if (msg.videoMessage) return { text: msg.videoMessage.caption || null, messageType: "video", mediaMimeType: msg.videoMessage.mimetype || "video/mp4", fileName: null };
  if (msg.documentMessage) return { text: msg.documentMessage.caption || null, messageType: "document", mediaMimeType: msg.documentMessage.mimetype || "application/octet-stream", fileName: msg.documentMessage.fileName || null };
  return { text: "[mensagem não suportada]", messageType: "note", mediaMimeType: null, fileName: null };
}

export function jidToPhoneE164(jid: string): string | null {
  const digits = jid.replace(/@.*$/, "").replace(/[^0-9]/g, "");
  if (!digits || digits.length < 8) return null;
  return `+${digits}`;
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
