import { NextRequest } from "next/server";
import { requireFullAccess } from "@/lib/auth";
import { apiSuccess, apiUnauthorized, apiForbidden } from "@/lib/api/response";
import { searchContacts } from "@/lib/db/queries/contacts";

export async function GET(req: NextRequest) {
  try {
    const user = await requireFullAccess();
    const sp = req.nextUrl.searchParams;
    const data = await searchContacts(user.company_id, {
      q: sp.get("q") || undefined,
      category: sp.get("category") || undefined,
      lineId: sp.get("line_id") || undefined,
      limit: sp.get("limit") ? Math.min(200, Number(sp.get("limit"))) : 50,
    });
    return apiSuccess(data);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    if (error instanceof Error && error.message === "Forbidden") return apiForbidden();
    return apiSuccess([]);
  }
}
