import { NextRequest } from "next/server";
import { z } from "zod";
import { requireAuth, requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { collectMarketForProperty } from "@/lib/market/collect";
import { GeckoApiError } from "@/lib/gecko/client";
import {
  apiSuccess,
  apiError,
  apiUnauthorized,
  apiForbidden,
  apiNotFound,
  apiServerError,
} from "@/lib/api/response";

export const maxDuration = 60;

interface Params {
  params: Promise<{ id: string }>;
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const runSchema = z.object({
  source: z.enum(["airbnb", "booking"]).optional(),
  check_in: z.string().regex(DATE),
  check_out: z.string().regex(DATE),
  pages: z.number().int().min(1).max(3).optional(),
});

async function assertOwnership(propertyId: string, companyId: string) {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("properties")
    .select("id, company_id")
    .eq("id", propertyId)
    .maybeSingle();
  const prop = data as { id: string; company_id: string } | null;
  if (!prop) return "notfound" as const;
  if (prop.company_id !== companyId) return "forbidden" as const;
  return "ok" as const;
}

/** Latest market snapshot for a property + its comps (most recent run). */
export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const user = await requireAuth();
    const { id } = await params;
    const own = await assertOwnership(id, user.company_id);
    if (own === "notfound") return apiNotFound("Property");
    if (own === "forbidden") return apiForbidden();

    const supabase = createAdminClient();
    const { data: snap } = await supabase
      .from("market_snapshots")
      .select("*")
      .eq("property_id", id)
      .order("captured_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!snap) return apiSuccess({ snapshot: null, comps: [] });

    const snapshot = snap as { id: string };
    const { data: comps } = await supabase
      .from("market_comps")
      .select("id, source, listing_id, url, title, name, category, city, latitude, longitude, bedrooms, nightly_price, total_price, currency, rating, reviews_count, is_superhost, guest_favorite, thumbnail")
      .eq("snapshot_id", snapshot.id)
      .order("nightly_price", { ascending: true });

    return apiSuccess({ snapshot, comps: comps || [] });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    if (error instanceof Error && error.message === "Forbidden") return apiForbidden();
    return apiServerError(error);
  }
}

/** Run a new market collection (admin/manager — consumes Gecko credits). */
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const user = await requireRole(["admin", "manager"]);
    const { id } = await params;
    const own = await assertOwnership(id, user.company_id);
    if (own === "notfound") return apiNotFound("Property");
    if (own === "forbidden") return apiForbidden();

    const body = await request.json();
    const validation = runSchema.safeParse(body);
    if (!validation.success) return apiError("Validation failed", 400, validation.error.flatten());
    const data = validation.data;

    if (new Date(data.check_out) <= new Date(data.check_in)) {
      return apiError("check_out deve ser depois de check_in", 400);
    }

    const result = await collectMarketForProperty({
      propertyId: id,
      source: data.source,
      checkIn: data.check_in,
      checkOut: data.check_out,
      pages: data.pages,
    });
    return apiSuccess(result, 201);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    if (error instanceof Error && error.message === "Forbidden") return apiForbidden();
    if (error instanceof GeckoApiError) {
      return apiError(`GeckoAPI: ${error.message}`, 502, error.body);
    }
    return apiServerError(error);
  }
}
