import { NextRequest } from "next/server";
import { z } from "zod";
import { extractAirbnbListing, GeckoApiError } from "@/lib/gecko/client";
import { importAirbnbToNewProperty } from "@/lib/gecko/import-airbnb";
import { requireRole } from "@/lib/auth";
import {
  apiSuccess,
  apiError,
  apiUnauthorized,
  apiForbidden,
  apiServerError,
} from "@/lib/api/response";

const bodySchema = z.object({
  url: z.string().url("Invalid URL"),
  code: z.string().min(2).max(40).regex(/^[A-Z0-9-]+$/, "Code must be uppercase letters, numbers, and hyphens"),
  slug: z.string().min(2).max(100).regex(/^[a-z0-9-]+$/, "Slug must be lowercase, numbers, and hyphens"),
  name: z.string().max(120).optional(),
  base_price: z.coerce.number().min(0).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const user = await requireRole(["admin", "manager"]);
    const body = await request.json();
    const validation = bodySchema.safeParse(body);
    if (!validation.success) {
      return apiError("Validation failed", 400, validation.error.flatten());
    }
    const { url, code, slug, name, base_price } = validation.data;

    const gecko = await extractAirbnbListing(url);
    const listing = gecko.data.data;
    if (!listing || !listing.listingId) {
      return apiError("Gecko response did not contain a valid listing", 502, gecko);
    }

    const result = await importAirbnbToNewProperty({
      listing,
      companyId: user.company_id,
      code,
      slug,
      name,
      basePriceCents: base_price !== undefined ? Math.round(base_price * 100) : 0,
    });

    return apiSuccess({
      ...result,
      gecko: {
        requestId: gecko.requestId,
        executionId: gecko.executionId,
        extractedAt: gecko.data.extractedAt,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    if (error instanceof Error && error.message === "Forbidden") return apiForbidden();
    if (error instanceof GeckoApiError) {
      return apiError(`Gecko: ${error.message}`, error.status || 502, error.body);
    }
    return apiServerError(error);
  }
}
