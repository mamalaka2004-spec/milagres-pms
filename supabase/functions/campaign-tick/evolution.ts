// Mini-cliente Evolution API para Deno (edge functions).
// Espelha src/lib/whatsapp/evolution.ts do app Next — mesma heurística de @lid.

export interface EvoConfig {
  baseUrl: string;
  apiKey: string;
  instance: string;
}

export function normalizePhone(input: string): string {
  return input.replace(/[^0-9]/g, "");
}

/**
 * Campo `number` da Evolution a partir do telefone armazenado.
 * 14+ dígitos = identificador de privacidade "@lid" (números BR E.164 têm ≤13);
 * nesse caso endereçamos com o JID completo `<lid>@lid`.
 */
export function toEvolutionRecipient(phone: string): string {
  const digits = normalizePhone(phone);
  if (/@lid$/i.test(phone.trim())) return `${digits}@lid`;
  if (digits.length >= 14) return `${digits}@lid`;
  return digits;
}

export interface SendResult {
  external_id: string | null;
  status: number;
  raw: unknown;
}

async function evoPost(cfg: EvoConfig, path: string, body: unknown): Promise<SendResult> {
  const res = await fetch(`${cfg.baseUrl.replace(/\/+$/, "")}${path}/${cfg.instance}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: cfg.apiKey },
    body: JSON.stringify(body),
  });
  const raw = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(
      `Evolution ${path} HTTP ${res.status} — ${JSON.stringify(raw).slice(0, 300)}`
    ) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
  const id = (raw as { key?: { id?: string } })?.key?.id ?? null;
  return { external_id: id, status: res.status, raw };
}

export function sendText(cfg: EvoConfig, toPhone: string, text: string): Promise<SendResult> {
  return evoPost(cfg, "/message/sendText", { number: toEvolutionRecipient(toPhone), text });
}

export function sendMedia(
  cfg: EvoConfig,
  toPhone: string,
  url: string,
  mimeType: string,
  caption?: string,
  fileName?: string
): Promise<SendResult> {
  const mediaType = mimeType.startsWith("image/")
    ? "image"
    : mimeType.startsWith("video/")
    ? "video"
    : mimeType.startsWith("audio/")
    ? "audio"
    : "document";
  return evoPost(cfg, "/message/sendMedia", {
    number: toEvolutionRecipient(toPhone),
    mediatype: mediaType,
    mimetype: mimeType,
    caption: caption || "",
    media: url,
    fileName: fileName || "file",
  });
}

/** Presença "digitando…" antes do envio. Erros são ignoráveis pelo chamador. */
export async function sendPresence(cfg: EvoConfig, toPhone: string, seconds: number): Promise<void> {
  const delay = Math.max(1000, Math.min(seconds * 1000, 8000));
  const number = toEvolutionRecipient(toPhone);
  // Formatos v1 (options.{presence,delay}) e v2 (top-level) — mandamos ambos.
  await evoPost(cfg, "/chat/sendPresence", {
    number,
    presence: "composing",
    delay,
    options: { presence: "composing", delay },
  });
}

/** Estado da conexão da instância: "open" = número conectado. */
export async function getConnectionState(cfg: EvoConfig): Promise<string> {
  const res = await fetch(
    `${cfg.baseUrl.replace(/\/+$/, "")}/instance/connectionState/${cfg.instance}`,
    { headers: { apikey: cfg.apiKey } }
  );
  const raw = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Evolution connectionState HTTP ${res.status}`);
  return (raw as { instance?: { state?: string } })?.instance?.state || "unknown";
}
