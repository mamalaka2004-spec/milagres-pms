import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import { logActivity } from "@/lib/audit/log";
import { apiSuccess, apiError, apiNotFound, apiUnauthorized, apiForbidden, apiServerError } from "@/lib/api/response";
import { getGuideAdmin, updateGuideAdmin, deleteGuideAdmin, signGuidePdf } from "@/lib/db/queries/knowledge-admin";
import { guideUpdateSchema } from "@/lib/validations/knowledge";

type Params = { params: Promise<{ id: string }> };

/** Guia único + URL assinada do PDF (privado) para o editor. */
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const user = await requireRole(["admin", "manager"]);
    const { id } = await params;
    const guide = await getGuideAdmin(id, user.company_id);
    if (!guide) return apiNotFound("Guia");
    const pdf_url = await signGuidePdf(guide.pdf_path);
    return apiSuccess({ ...guide, pdf_url });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    if (error instanceof Error && error.message === "Forbidden") return apiForbidden();
    return apiServerError(error);
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const user = await requireRole(["admin", "manager"]);
    const { id } = await params;
    const parsed = guideUpdateSchema.safeParse(await req.json());
    if (!parsed.success) return apiError("Dados inválidos", 400, parsed.error.flatten());
    const existing = await getGuideAdmin(id, user.company_id);
    if (!existing) return apiNotFound("Guia");
    try {
      const row = await updateGuideAdmin(id, user.company_id, parsed.data);
      await logActivity({ user, action: "property_guide.update", entityType: "property_guide", entityId: id, details: { label: row.name } });
      return apiSuccess(row);
    } catch (e) {
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

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const user = await requireRole(["admin", "manager"]);
    const { id } = await params;
    const existing = await getGuideAdmin(id, user.company_id);
    if (!existing) return apiNotFound("Guia");
    await deleteGuideAdmin(id, user.company_id);
    await logActivity({ user, action: "property_guide.delete", entityType: "property_guide", entityId: id, details: { label: existing.name } });
    return apiSuccess({ id });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    if (error instanceof Error && error.message === "Forbidden") return apiForbidden();
    return apiServerError(error);
  }
}
