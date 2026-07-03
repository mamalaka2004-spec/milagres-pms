import { NextRequest } from "next/server";
import { requireAuth, requireRole } from "@/lib/auth";
import { logActivity } from "@/lib/audit/log";
import { apiSuccess, apiError, apiUnauthorized, apiForbidden, apiServerError } from "@/lib/api/response";
import { listGroups, createGroup } from "@/lib/db/queries/pricing";
import { propertyGroupSchema } from "@/lib/validations/pricing";

export async function GET() {
  try {
    const user = await requireAuth();
    const data = await listGroups(user.company_id);
    return apiSuccess(data);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    // Tabela ainda não existe (migration 026 não rodada) — degrada.
    return apiSuccess([]);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireRole(["admin", "manager"]);
    const parsed = propertyGroupSchema.safeParse(await req.json());
    if (!parsed.success) return apiError("Dados inválidos", 400, parsed.error.flatten());
    const group = await createGroup(user.company_id, parsed.data);
    await logActivity({ user, action: "property_group.create", entityType: "property_group", entityId: group.id, details: { label: group.name } });
    return apiSuccess(group, 201);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    if (error instanceof Error && error.message === "Forbidden") return apiForbidden();
    return apiServerError(error);
  }
}
