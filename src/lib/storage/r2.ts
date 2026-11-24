import { AwsClient } from "aws4fetch";

/**
 * Cloudflare R2 (S3-compatible) — used for WhatsApp chat media so it doesn't count
 * against the Supabase Storage quota.
 *
 * Env (server-only):
 *   R2_ACCOUNT_ID          Cloudflare account id
 *   R2_ACCESS_KEY_ID       R2 API token — Access Key ID
 *   R2_SECRET_ACCESS_KEY   R2 API token — Secret Access Key
 *   R2_BUCKET              e.g. milagres-whatsapp-media
 *   R2_PUBLIC_BASE_URL     public base URL of the bucket (r2.dev or custom domain), no trailing slash
 *
 * If any is missing, callers fall back to Supabase Storage (see lib/whatsapp/media.ts).
 */

type R2Config = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  publicBaseUrl: string;
};

function readConfig(): R2Config | null {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET;
  const publicBaseUrl = process.env.R2_PUBLIC_BASE_URL?.replace(/\/+$/, "");
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket || !publicBaseUrl) return null;
  return { accountId, accessKeyId, secretAccessKey, bucket, publicBaseUrl };
}

export function isR2Enabled(): boolean {
  return readConfig() !== null;
}

let client: AwsClient | null = null;
function getClient(cfg: R2Config): AwsClient {
  if (!client) {
    client = new AwsClient({
      accessKeyId: cfg.accessKeyId,
      secretAccessKey: cfg.secretAccessKey,
      service: "s3",
      region: "auto",
    });
  }
  return client;
}

function encodeKey(key: string): string {
  return key.split("/").map(encodeURIComponent).join("/");
}

export function r2PublicUrl(key: string): string {
  const cfg = readConfig();
  if (!cfg) throw new Error("R2 not configured");
  return `${cfg.publicBaseUrl}/${encodeKey(key)}`;
}

/** Upload bytes to R2. Returns the public URL. Throws on failure. */
export async function r2Upload(
  key: string,
  body: Uint8Array | Buffer,
  opts: { contentType: string; cacheControl?: string },
): Promise<string> {
  const cfg = readConfig();
  if (!cfg) throw new Error("R2 not configured");
  const url = `https://${cfg.accountId}.r2.cloudflarestorage.com/${cfg.bucket}/${encodeKey(key)}`;
  const bytes = body instanceof Uint8Array ? body : new Uint8Array(body);
  // Assina com aws4fetch, mas envia com fetch direto passando os bytes: se o corpo
  // for repassado via Request, o Node envia em "chunked" (sem Content-Length) e o
  // R2 recusa com 411 MissingContentLength.
  const signed = await getClient(cfg).sign(url, {
    method: "PUT",
    body: bytes as unknown as BodyInit,
    headers: {
      "Content-Type": opts.contentType,
      "Cache-Control": opts.cacheControl ?? "public, max-age=31536000, immutable",
    },
  });
  const headers = new Headers(signed.headers);
  headers.set("Content-Length", String(bytes.byteLength));
  const res = await fetch(signed.url, {
    method: "PUT",
    headers,
    body: bytes as unknown as BodyInit,
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`R2 upload failed (${res.status}): ${text.slice(0, 200)}`);
  }
  return `${cfg.publicBaseUrl}/${encodeKey(key)}`;
}
