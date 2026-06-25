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

function getConfig(overrideInstance?: string, overrideKey?: string): EvolutionConfig {
  const baseUrl = process.env.EVOLUTION_API_URL;
  // Per-line instance token takes precedence over the env key, so each line can
  // talk to its own Evolution instance (the env key may only authorize one).
  const apiKey = overrideKey || process.env.EVOLUTION_API_KEY;
  const instance = overrideInstance || process.env.EVOLUTION_DEFAULT_INSTANCE;
  if (!baseUrl || !apiKey || !instance) {
    throw new Error("Evolution API not configured (EVOLUTION_API_URL / EVOLUTION_API_KEY / EVOLUTION_DEFAULT_INSTANCE)");
  }
  return { baseUrl: baseUrl.replace(/\/+$/, ""), apiKey, instance };
}

/** Thrown when Evolution rejects the API key for an instance (HTTP 401). */
export const EVO_UNAUTHORIZED = "EvoUnauthorized";

/** Strip Brazil-specific prefixes etc. and return a digits-only Evolution-style number (E.164 without "+"). */
export function normalizePhone(input: string): string {
  return input.replace(/[^0-9]/g, "");
}

/**
 * Build the Evolution `number` field from a stored contact phone.
 *
 * Many WhatsApp contacts now present as a privacy "@lid" identifier instead of a
 * real phone number. We stored those as the LID digits (14-15 digits), while real
 * Brazilian numbers are 12-13 digits (55 + DDD + number). When the value is a LID we
 * must address Evolution with the full `<lid>@lid` JID — Evolution resolves it to the
 * real number internally. Sending the bare LID digits as a phone number fails.
 */
export function toEvolutionRecipient(phone: string): string {
  const digits = normalizePhone(phone);
  // Already a JID? (caller passed something like "123@lid")
  if (/@lid$/i.test(phone.trim())) return `${digits}@lid`;
  // Heuristic: 14+ digits is a LID, not a phone (E.164 BR numbers are ≤13 digits).
  if (digits.length >= 14) return `${digits}@lid`;
  return digits;
}

export interface SendTextResult {
  external_id?: string;
  raw: unknown;
}

export async function sendText(
  toPhone: string,
  text: string,
  instance?: string,
  apiKey?: string
): Promise<SendTextResult> {
  const cfg = getConfig(instance, apiKey);
  const number = toEvolutionRecipient(toPhone);
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

export interface EvoContact {
  remoteJid: string;
  pushName?: string | null;
  name?: string | null;
}

/** List the saved contacts of an Evolution instance (has the WhatsApp profile names). */
export async function findContacts(instance?: string): Promise<EvoContact[]> {
  const cfg = getConfig(instance);
  const res = await fetch(`${cfg.baseUrl}/chat/findContacts/${cfg.instance}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: cfg.apiKey },
    body: JSON.stringify({}),
  });
  const raw = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`Evolution findContacts failed: HTTP ${res.status}`);
  const arr = Array.isArray(raw) ? raw : (raw as { contacts?: unknown[] })?.contacts || [];
  return (arr as Array<Record<string, unknown>>).map((c) => ({
    remoteJid: String(c.remoteJid || c.id || ""),
    pushName: (c.pushName as string) || (c.name as string) || null,
    name: (c.name as string) || null,
  }));
}

/* ─────────────────────── Connection / QR ─────────────────────── */

export interface EvoConnection {
  state: string; // open | connecting | close | unknown
  qrBase64?: string; // data:image/png;base64,... for <img>
  pairingCode?: string; // short code to type in WhatsApp ("link with phone number")
  code?: string; // raw QR string
}

/** Current connection state of an instance. Throws EVO_UNAUTHORIZED on 401. */
export async function getConnectionState(instance: string, apiKey?: string): Promise<string> {
  const cfg = getConfig(instance, apiKey);
  const res = await fetch(`${cfg.baseUrl}/instance/connectionState/${cfg.instance}`, {
    headers: { apikey: cfg.apiKey },
  });
  if (res.status === 401) throw new Error(EVO_UNAUTHORIZED);
  const raw = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Evolution connectionState HTTP ${res.status}: ${JSON.stringify(raw).slice(0, 200)}`);
  return (raw as { instance?: { state?: string } })?.instance?.state || "unknown";
}

/** Ask the instance to (re)connect, returning the QR/pairing payload. Throws EVO_UNAUTHORIZED on 401. */
export async function connectInstance(instance: string, apiKey?: string): Promise<EvoConnection> {
  const cfg = getConfig(instance, apiKey);
  const res = await fetch(`${cfg.baseUrl}/instance/connect/${cfg.instance}`, {
    headers: { apikey: cfg.apiKey },
  });
  if (res.status === 401) throw new Error(EVO_UNAUTHORIZED);
  const raw = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Evolution connect HTTP ${res.status}: ${JSON.stringify(raw).slice(0, 200)}`);
  const r = raw as {
    base64?: string; code?: string; pairingCode?: string; count?: number;
    qrcode?: { base64?: string; code?: string; pairingCode?: string };
    instance?: { state?: string };
  };
  const base64 = r.base64 || r.qrcode?.base64;
  const code = r.code || r.qrcode?.code;
  const pairingCode = r.pairingCode || r.qrcode?.pairingCode;
  const state = r.instance?.state || (base64 || code ? "connecting" : "unknown");
  const qrBase64 = base64
    ? base64.startsWith("data:")
      ? base64
      : `data:image/png;base64,${base64}`
    : undefined;
  return { state, qrBase64, code, pairingCode };
}

/* ─────────────────────── Inbound media download ─────────────────────── */

export interface EvoMediaBase64 {
  base64: string;
  mimetype: string;
  fileName: string | null;
  mediaType: string | null;
}

/**
 * Download + decrypt an inbound media message via Evolution. WhatsApp delivers media
 * as encrypted CDN URLs (mmg.whatsapp.net/...) that can't be displayed directly — this
 * returns the decrypted bytes (base64) so we can re-host them on our storage.
 * Works with just the message id.
 */
export async function getBase64FromMediaMessage(
  messageId: string,
  instance?: string,
  apiKey?: string
): Promise<EvoMediaBase64> {
  const cfg = getConfig(instance, apiKey);
  const res = await fetch(`${cfg.baseUrl}/chat/getBase64FromMediaMessage/${cfg.instance}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: cfg.apiKey },
    body: JSON.stringify({ message: { key: { id: messageId } }, convertToMp4: false }),
  });
  const raw = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Evolution getBase64 HTTP ${res.status}: ${JSON.stringify(raw).slice(0, 160)}`);
  const r = raw as { base64?: string; media?: string; mimetype?: string; fileName?: string; mediaType?: string };
  const base64 = r.base64 || r.media || "";
  if (!base64) throw new Error("Evolution getBase64: resposta vazia");
  return {
    base64,
    mimetype: r.mimetype || "application/octet-stream",
    fileName: r.fileName || null,
    mediaType: r.mediaType || null,
  };
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
  instance?: string,
  apiKey?: string
): Promise<SendTextResult> {
  const cfg = getConfig(instance, apiKey);
  const number = toEvolutionRecipient(toPhone);
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
