import { requireFullAccess } from "@/lib/auth";
import { apiSuccess, apiUnauthorized, apiForbidden } from "@/lib/api/response";
import { listContactTags } from "@/lib/db/queries/contacts";

/** Tags distintas em uso no fonebook (sugestões + filtros). */
export async function GET() {
  try {
    const user = await requireFullAccess();
    return apiSuccess(await listContactTags(user.company_id));
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    if (error instanceof Error && error.message === "Forbidden") return apiForbidden();
    return apiSuccess([]);
  }
}
