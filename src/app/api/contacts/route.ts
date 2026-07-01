import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { apiSuccess, apiUnauthorized } from "@/lib/api/response";
import { searchContacts } from "@/lib/db/queries/contacts";

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth();
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
    return apiSuccess([]);
  }
}
