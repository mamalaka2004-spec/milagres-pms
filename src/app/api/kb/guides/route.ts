import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import { logActivity } from "@/lib/audit/log";
import { apiSuccess, apiError, apiUnauthorized, apiForbidden, apiServerError } from "@/lib/api/response";
import { listGuidesAdmin, createGuideAdmin } from "@/lib/db/queries/knowledge-admin";
import { guideCreateSchema } from "@/lib/validations/knowledge";

export async function GET() {
  try {
    const user = await requireRole(["admin", "manager"]);
    const data = await listGuidesAdmin(user.company_id);
    return apiSuccess(data);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    if (error instanceof Error && error.message === "Forbidden") return apiForbidden();
    return apiServerError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireRole(["admin", "manager"]);
    const parsed = guideCreateSchema.safeParse(await req.json());
    if (!parsed.success) return apiError("Dados inválidos", 400, parsed.error.flatten());
    try {
      const row = await createGuideAdmin(user.company_id, parsed.data);
      await logActivity({ user, action: "property_guide.create", entityType: "property_guide", entityId: row.id, details: { label: row.name } });
      return apiSuccess(row, 201);
    } catch (e) {
      // UNIQUE (company_id, unit_code)
      if (e instanceof Error && /duplicate|unique/i.test(e.message)) {
        return apiError("Já existe um guia com esse código de unidade.", 409);
      }
      throw e;
    }
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    if (error instanceof Error && error.message === "Forbidden") return apiForbidden();
    return apiServerError(error);
  }
}

export const dynamic = "force-dynamic";
