import { NextRequest } from "next/server";
import { requireFullAccess } from "@/lib/auth";
import { globalSearch } from "@/lib/db/queries/search";
import { apiSuccess, apiUnauthorized, apiForbidden, apiServerError } from "@/lib/api/response";

/** GET /api/search?q=term — global search across reservations, guests, properties. */
export async function GET(request: NextRequest) {
  try {
    const user = await requireFullAccess();
    const q = new URL(request.url).searchParams.get("q") || "";
    const results = await globalSearch(user.company_id, q);
    return apiSuccess(results);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    if (error instanceof Error && error.message === "Forbidden") return apiForbidden();
    return apiServerError(error);
  }
}
