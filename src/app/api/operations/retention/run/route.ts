import { requireRole } from "@/lib/auth";
import { logActivity } from "@/lib/audit/log";
import { runRetentionForCompany } from "@/lib/db/queries/ops-jobs";
import {
  apiSuccess,
  apiUnauthorized,
  apiForbidden,
  apiServerError,
} from "@/lib/api/response";

export const maxDuration = 60;

/** Execução manual da retenção para a própria empresa (botão em Ajustes → Operações). */
export async function POST() {
  try {
    const user = await requireRole(["admin", "manager"]);
    const result = await runRetentionForCompany(user.company_id);
    await logActivity({
      user,
      action: "operations_settings.update",
      entityType: "operations_settings",
      entityId: user.company_id,
      details: { label: "Retenção executada", removed: result.removed, scanned: result.scanned },
    });
    return apiSuccess(result);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    if (error instanceof Error && error.message === "Forbidden") return apiForbidden();
    return apiServerError(error);
  }
}
