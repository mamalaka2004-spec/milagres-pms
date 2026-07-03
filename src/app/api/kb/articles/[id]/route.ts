import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import { logActivity } from "@/lib/audit/log";
import { apiSuccess, apiError, apiNotFound, apiUnauthorized, apiForbidden, apiServerError } from "@/lib/api/response";
import { getArticleAdmin, updateArticleAdmin, deleteArticleAdmin } from "@/lib/db/queries/knowledge-admin";
import { articleUpdateSchema } from "@/lib/validations/knowledge";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const user = await requireRole(["admin", "manager"]);
    const { id } = await params;
    const parsed = articleUpdateSchema.safeParse(await req.json());
    if (!parsed.success) return apiError("Dados inválidos", 400, parsed.error.flatten());
    const existing = await getArticleAdmin(id, user.company_id);
    if (!existing) return apiNotFound("Artigo");
    const row = await updateArticleAdmin(id, user.company_id, parsed.data);
    await logActivity({ user, action: "kb_article.update", entityType: "kb_article", entityId: id, details: { label: row.title } });
    return apiSuccess(row);
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
    const existing = await getArticleAdmin(id, user.company_id);
    if (!existing) return apiNotFound("Artigo");
    await deleteArticleAdmin(id, user.company_id);
    await logActivity({ user, action: "kb_article.delete", entityType: "kb_article", entityId: id, details: { label: existing.title } });
    return apiSuccess({ id });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    if (error instanceof Error && error.message === "Forbidden") return apiForbidden();
    return apiServerError(error);
  }
}
