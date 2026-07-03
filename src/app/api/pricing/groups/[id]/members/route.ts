import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import { logActivity } from "@/lib/audit/log";
import { apiSuccess, apiError, apiUnauthorized, apiForbidden, apiNotFound, apiServerError } from "@/lib/api/response";
import { getGroup, setGroupMembers } from "@/lib/db/queries/pricing";
import { groupMembersSchema } from "@/lib/validations/pricing";
import { createAdminClient } from "@/lib/supabase/admin";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PUT(req: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireRole(["admin", "manager"]);
    const { id } = await params;
    const parsed = groupMembersSchema.safeParse(await req.json());
    if (!parsed.success) return apiError("Dados inválidos", 400, parsed.error.flatten());

    const group = await getGroup(user.company_id, id);
    if (!group) return apiNotFound("Grupo");

    // Só imóveis da empresa entram no grupo
    const supabase = createAdminClient();
    const { data: owned } = await supabase
      .from("properties")
      .select("id")
      .eq("company_id", user.company_id)
      .is("deleted_at", null)
      .in("id", parsed.data.property_ids.length ? parsed.data.property_ids : ["00000000-0000-0000-0000-000000000000"]);
    const validIds = ((owned as { id: string }[]) || []).map((p) => p.id);

    await setGroupMembers(id, validIds);
    await logActivity({ user, action: "property_group.members", entityType: "property_group", entityId: id, details: { label: group.name, count: validIds.length } });
    return apiSuccess({ property_ids: validIds });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    if (error instanceof Error && error.message === "Forbidden") return apiForbidden();
    return apiServerError(error);
  }
}
