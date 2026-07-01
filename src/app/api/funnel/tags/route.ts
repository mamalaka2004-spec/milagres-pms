import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { logActivity } from "@/lib/audit/log";
import { apiSuccess, apiError, apiUnauthorized, apiServerError } from "@/lib/api/response";
import { listTags, createTag } from "@/lib/db/queries/funnel";
import { tagCreateSchema } from "@/lib/validations/funnel";
import type { FunnelType } from "@/types/funnel";

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth();
    const typeParam = req.nextUrl.searchParams.get("type") as FunnelType | null;
    const type = typeParam === "locacao" || typeParam === "vendas" ? typeParam : undefined;
    const data = await listTags(user.company_id, type);
    return apiSuccess(data);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    return apiSuccess([]);
  }
}

// Criação liberada a qualquer usuário autenticado (tag picker inline no chat).
export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth();
    const parsed = tagCreateSchema.safeParse(await req.json());
    if (!parsed.success) return apiError("Dados inválidos", 400, parsed.error.flatten());
    try {
      const tag = await createTag(user.company_id, parsed.data);
      await logActivity({ user, action: "tag.create", entityType: "tag", entityId: tag.id, details: { label: tag.name, type: tag.type } });
      return apiSuccess(tag);
    } catch (e) {
      // UNIQUE(company,type,name) — devolve a tag existente.
      if (e instanceof Error && /duplicate|unique/i.test(e.message)) {
        const existing = (await listTags(user.company_id, parsed.data.type)).find(
          (t) => t.name.toLowerCase() === parsed.data.name.toLowerCase()
        );
        if (existing) return apiSuccess(existing);
      }
      throw e;
    }
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    return apiServerError(error);
  }
}
