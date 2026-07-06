import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import { logActivity } from "@/lib/audit/log";
import {
  operationsSettingsSchema,
  AUTOMATION_SETTING_KEY,
  RETENTION_SETTING_KEY,
} from "@/lib/validations/operations";
import {
  getAutomationSettings,
  getRetentionSettings,
  upsertSetting,
} from "@/lib/db/queries/settings";
import {
  apiSuccess,
  apiError,
  apiUnauthorized,
  apiForbidden,
  apiServerError,
} from "@/lib/api/response";

/** Config de Operações (automação de limpeza + retenção de storage). */
export async function GET() {
  try {
    const user = await requireRole(["admin", "manager"]);
    const [automation, retention] = await Promise.all([
      getAutomationSettings(user.company_id),
      getRetentionSettings(user.company_id),
    ]);
    return apiSuccess({ automation, retention });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    if (error instanceof Error && error.message === "Forbidden") return apiForbidden();
    return apiServerError(error);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await requireRole(["admin", "manager"]);
    const body = await request.json();
    const v = operationsSettingsSchema.safeParse(body);
    if (!v.success) return apiError("Validation failed", 400, v.error.flatten());

    if (v.data.automation) {
      await upsertSetting(user.company_id, AUTOMATION_SETTING_KEY, v.data.automation, "operations");
    }
    if (v.data.retention) {
      await upsertSetting(user.company_id, RETENTION_SETTING_KEY, v.data.retention, "operations");
    }
    await logActivity({
      user,
      action: "operations_settings.update",
      entityType: "operations_settings",
      entityId: user.company_id,
      details: {
        ...(v.data.automation ? { automation: v.data.automation } : {}),
        ...(v.data.retention ? { retention: v.data.retention } : {}),
      },
    });

    const [automation, retention] = await Promise.all([
      getAutomationSettings(user.company_id),
      getRetentionSettings(user.company_id),
    ]);
    return apiSuccess({ automation, retention });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    if (error instanceof Error && error.message === "Forbidden") return apiForbidden();
    return apiServerError(error);
  }
}
