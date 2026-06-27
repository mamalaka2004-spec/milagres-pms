import type { GeckoExtractResponse, GeckoPlpParams, GeckoPlpResponse } from "./types";

const GECKO_BASE = "https://api.geckoapi.com.br/v1";

/** Low-level POST /extract. Returns parsed JSON or throws GeckoApiError. */
async function geckoExtract(
  payload: Record<string, unknown>,
  opts: { token?: string; signal?: AbortSignal } = {}
): Promise<unknown> {
  const token = opts.token || process.env.GECKOAPI_TOKEN;
  if (!token) throw new GeckoApiError("GECKOAPI_TOKEN is not configured");

  const res = await fetch(`${GECKO_BASE}/extract`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
    signal: opts.signal,
    cache: "no-store",
  });

  const text = await res.text();
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    throw new GeckoApiError(`Gecko returned non-JSON (status ${res.status})`, res.status, text.slice(0, 500));
  }
  if (!res.ok) {
    const msg =
      (body && typeof body === "object" && "error" in body && typeof (body as { error: unknown }).error === "string"
        ? (body as { error: string }).error
        : null) || `Gecko HTTP ${res.status}`;
    throw new GeckoApiError(msg, res.status, body);
  }
  return body;
}

/**
 * Extract a listing page (PLP) of competitor results. Costs 1 credit (Airbnb) or
 * 5 credits (Booking) per page. Returns the raw items + market metadata.
 */
export async function extractListings(
  params: GeckoPlpParams,
  opts: { token?: string; signal?: AbortSignal } = {}
): Promise<GeckoPlpResponse> {
  const target = params.source === "booking" ? "booking.com.br" : "airbnb.com.br";
  const payload: Record<string, unknown> = {
    target,
    type: "plp",
    url: params.url,
    page: params.page ?? 1,
  };
  if (params.address) payload.address = params.address;
  if (params.keyword) payload.keyword = params.keyword;
  if (params.startDate) payload.startDate = params.startDate;
  if (params.endDate) payload.endDate = params.endDate;
  if (params.numAdults != null) payload.numAdults = params.numAdults;
  if (params.numChildren != null) payload.numChildren = params.numChildren;
  if (params.numRooms != null) payload.numRooms = params.numRooms;
  if (params.latitude != null) payload.latitude = params.latitude;
  if (params.longitude != null) payload.longitude = params.longitude;
  if (params.lang) payload.lang = params.lang;
  if (params.currency) payload.currency = params.currency;
  // Booking PLP uses checkinDate/checkoutDate naming.
  if (params.source === "booking") {
    if (params.startDate) payload.checkinDate = params.startDate;
    if (params.endDate) payload.checkoutDate = params.endDate;
  }
  return (await geckoExtract(payload, opts)) as GeckoPlpResponse;
}

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
