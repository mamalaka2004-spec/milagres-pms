import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { logActivity } from "@/lib/audit/log";
import { createAdminClient } from "@/lib/supabase/admin";
import { apiSuccess, apiError, apiUnauthorized, apiForbidden, apiNotFound, apiServerError } from "@/lib/api/response";
import { getConversationTagsMap, setConversationTags } from "@/lib/db/queries/funnel";
import { setTagsSchema } from "@/lib/validations/funnel";

type Params = { params: Promise<{ id: string }> };

async function conversationCompany(id: string): Promise<string | null> {
  const { data } = await (createAdminClient().from("whatsapp_conversations") as any) // eslint-disable-line @typescript-eslint/no-explicit-any
    .select("company_id")
    .eq("id", id)
    .maybeSingle();
  return (data as { company_id: string } | null)?.company_id ?? null;
}

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const user = await requireAuth();
    const { id } = await params;
    const company = await conversationCompany(id);
    if (!company) return apiNotFound("Conversa");
    if (company !== user.company_id) return apiForbidden();
    const map = await getConversationTagsMap(user.company_id, [id]);
    return apiSuccess(map[id] || []);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    return apiSuccess([]);
  }
}

export async function PUT(req: NextRequest, { params }: Params) {
  try {
    const user = await requireAuth();
    const { id } = await params;
    const company = await conversationCompany(id);
    if (!company) return apiNotFound("Conversa");
    if (company !== user.company_id) return apiForbidden();
    const parsed = setTagsSchema.safeParse(await req.json());
    if (!parsed.success) return apiError("Dados inválidos", 400, parsed.error.flatten());
    await setConversationTags(id, parsed.data.tag_ids, user.id);
    await logActivity({ user, action: "conversation.tags", entityType: "conversation", entityId: id, details: { count: parsed.data.tag_ids.length } });
    return apiSuccess({ id, tag_ids: parsed.data.tag_ids });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    if (error instanceof Error && error.message === "Forbidden") return apiForbidden();
    return apiServerError(error);
  }
}
