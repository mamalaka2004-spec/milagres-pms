import { NextRequest } from "next/server";
import { z } from "zod";
import { requireFullAccess, requireRole } from "@/lib/auth";
import { logActivity } from "@/lib/audit/log";
import { apiSuccess, apiError, apiUnauthorized, apiForbidden, apiServerError } from "@/lib/api/response";
import {
  listContactTags,
  listContactTagsWithCount,
  renameContactTag,
  deleteContactTag,
} from "@/lib/db/queries/contacts";

/** Etiquetas do fonebook. `?counts=1` devolve [{tag,count}]; senão string[]. */
export async function GET(req: NextRequest) {
  try {
    const user = await requireFullAccess();
    if (req.nextUrl.searchParams.get("counts") === "1") {
      return apiSuccess(await listContactTagsWithCount(user.company_id));
    }
    return apiSuccess(await listContactTags(user.company_id));
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    if (error instanceof Error && error.message === "Forbidden") return apiForbidden();
    return apiSuccess([]);
  }
}

const manageSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("rename"), tag: z.string().min(1).max(40), to: z.string().min(1).max(40) }),
  z.object({ action: z.literal("delete"), tag: z.string().min(1).max(40) }),
]);

/** Gerenciar etiquetas em lote: renomear (mescla) ou excluir de toda a base. */
export async function POST(req: NextRequest) {
  try {
    const user = await requireRole(["admin", "manager"]);
    const parsed = manageSchema.safeParse(await req.json());
    if (!parsed.success) return apiError("Dados inválidos", 400, parsed.error.flatten());

    if (parsed.data.action === "rename") {
      const affected = await renameContactTag(user.company_id, parsed.data.tag, parsed.data.to);
      await logActivity({ user, action: "contact.tag_rename", entityType: "whatsapp_contact", details: { from: parsed.data.tag, to: parsed.data.to, affected } });
      return apiSuccess({ affected });
    }
    const affected = await deleteContactTag(user.company_id, parsed.data.tag);
    await logActivity({ user, action: "contact.tag_delete", entityType: "whatsapp_contact", details: { tag: parsed.data.tag, affected } });
    return apiSuccess({ affected });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    if (error instanceof Error && error.message === "Forbidden") return apiForbidden();
    return apiServerError(error);
  }
}
