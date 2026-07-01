import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { logActivity } from "@/lib/audit/log";
import { apiSuccess, apiError, apiUnauthorized, apiForbidden, apiNotFound, apiServerError } from "@/lib/api/response";
import { getDeal, setDealTags } from "@/lib/db/queries/funnel";
import { setTagsSchema } from "@/lib/validations/funnel";

type Params = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, { params }: Params) {
  try {
    const user = await requireAuth();
    const { id } = await params;
    const deal = await getDeal(id);
    if (!deal) return apiNotFound("Negócio");
    if (deal.company_id !== user.company_id) return apiForbidden();
    const parsed = setTagsSchema.safeParse(await req.json());
    if (!parsed.success) return apiError("Dados inválidos", 400, parsed.error.flatten());
    await setDealTags(id, parsed.data.tag_ids);
    await logActivity({ user, action: "funnel_deal.tags", entityType: "funnel_deal", entityId: id, details: { count: parsed.data.tag_ids.length } });
    return apiSuccess({ id, tag_ids: parsed.data.tag_ids });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    if (error instanceof Error && error.message === "Forbidden") return apiForbidden();
    return apiServerError(error);
  }
}
