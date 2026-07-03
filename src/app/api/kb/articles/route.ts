import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import { logActivity } from "@/lib/audit/log";
import { apiSuccess, apiError, apiUnauthorized, apiForbidden, apiServerError } from "@/lib/api/response";
import { listArticlesAdmin, createArticleAdmin } from "@/lib/db/queries/knowledge-admin";
import { articleCreateSchema } from "@/lib/validations/knowledge";

export async function GET(req: NextRequest) {
  try {
    const user = await requireRole(["admin", "manager"]);
    const category = req.nextUrl.searchParams.get("category") || undefined;
    const scope = req.nextUrl.searchParams.get("scope") || undefined;
    const data = await listArticlesAdmin(user.company_id, { category, scope });
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
    const parsed = articleCreateSchema.safeParse(await req.json());
    if (!parsed.success) return apiError("Dados inválidos", 400, parsed.error.flatten());
    const row = await createArticleAdmin(user.company_id, parsed.data);
    await logActivity({ user, action: "kb_article.create", entityType: "kb_article", entityId: row.id, details: { label: row.title } });
    return apiSuccess(row, 201);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    if (error instanceof Error && error.message === "Forbidden") return apiForbidden();
    return apiServerError(error);
  }
}

export const dynamic = "force-dynamic";
