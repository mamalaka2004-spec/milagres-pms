import type { GeckoExtractResponse } from "./types";

const GECKO_BASE = "https://api.geckoapi.com.br/v1";

export class GeckoApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly body?: unknown
  ) {
    super(message);
  }
}

export async function extractAirbnbListing(
  url: string,
  opts: { token?: string; signal?: AbortSignal } = {}
): Promise<GeckoExtractResponse> {
  const token = opts.token || process.env.GECKOAPI_TOKEN;
  if (!token) throw new GeckoApiError("GECKOAPI_TOKEN is not configured");

  const res = await fetch(`${GECKO_BASE}/extract`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      target: "airbnb.com.br",
      type: "pdp",
      url,
    }),
    signal: opts.signal,
    cache: "no-store",
  });

  const text = await res.text();
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    throw new GeckoApiError(
      `Gecko returned non-JSON (status ${res.status})`,
      res.status,
      text.slice(0, 500)
    );
  }

  if (!res.ok) {
    const msg =
      (body && typeof body === "object" && "error" in body && typeof (body as { error: unknown }).error === "string"
        ? (body as { error: string }).error
        : null) || `Gecko HTTP ${res.status}`;
    throw new GeckoApiError(msg, res.status, body);
  }

  return body as GeckoExtractResponse;
}
