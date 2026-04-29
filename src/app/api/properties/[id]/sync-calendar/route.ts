import { NextRequest } from "next/server";
import { syncAllForProperty } from "@/lib/ical/sync";
import { getPropertyById } from "@/lib/db/queries/properties";
import { requireRole } from "@/lib/auth";
import {
  apiSuccess,
  apiError,
  apiUnauthorized,
  apiForbidden,
  apiNotFound,
  apiServerError,
} from "@/lib/api/response";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(_request: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireRole(["admin", "manager"]);
    const { id } = await params;
    const property = await getPropertyById(id);
    if (!property) return apiNotFound("Property");
    if ((property as { company_id: string }).company_id !== user.company_id) {
      return apiForbidden();
    }

    const results = await syncAllForProperty(id);
    if (results.length === 0) {
      return apiError("No iCal URLs configured for this property", 400);
    }
    return apiSuccess({ results });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    if (error instanceof Error && error.message === "Forbidden") return apiForbidden();
    return apiServerError(error);
  }
}
