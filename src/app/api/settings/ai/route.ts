import { NextRequest } from "next/server";
import { z } from "zod";
import { requireFullAccess, requireRole } from "@/lib/auth";
import { logActivity } from "@/lib/audit/log";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  apiSuccess,
  apiError,
  apiUnauthorized,
  apiForbidden,
  apiServerError,
} from "@/lib/api/response";

const updateSchema = z.object({
  ai_enabled: z.boolean(),
});

/**
 * System-level AI settings. The company `ai_enabled` flag is the master switch at the
 * top of the hierarchy: System → Line (whatsapp_lines.ai_enabled) → Conversation
 * (whatsapp_conversations.ai_active). We return the master flag plus a per-line summary
 * so the UI can show how the lower levels inherit from it.
 */
export async function GET() {
  try {
    const user = await requireFullAccess();
    const supabase = createAdminClient();

    const { data: companyRow, error: cErr } = await supabase
      .from("companies")
      .select("ai_enabled")
      .eq("id", user.company_id)
      .maybeSingle();
    if (cErr) throw cErr;

    const { data: lineRows, error: lErr } = await supabase
      .from("whatsapp_lines")
      .select("id, label, phone, ai_enabled, is_active")
      .eq("company_id", user.company_id)
      .order("label");
    if (lErr) throw lErr;

    return apiSuccess({
      ai_enabled: (companyRow as { ai_enabled?: boolean } | null)?.ai_enabled === true,
      lines: lineRows || [],
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    if (error instanceof Error && error.message === "Forbidden") return apiForbidden();
    return apiServerError(error);
  }
}

/** Flip the master AI switch (admin only). */
export async function PUT(request: NextRequest) {
  try {
    const user = await requireRole(["admin"]);
    const body = await request.json();
    const validation = updateSchema.safeParse(body);
    if (!validation.success) return apiError("Validation failed", 400, validation.error.flatten());

    const supabase = createAdminClient();
    const { error } = await (supabase.from("companies") as any) // eslint-disable-line @typescript-eslint/no-explicit-any
      .update({ ai_enabled: validation.data.ai_enabled })
      .eq("id", user.company_id);
    if (error) throw error;

    await logActivity({ user, action: "ai_settings.update", entityType: "ai_settings", entityId: user.company_id, details: { ai_enabled: validation.data.ai_enabled } });
    return apiSuccess({ ai_enabled: validation.data.ai_enabled });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    if (error instanceof Error && error.message === "Forbidden") return apiForbidden();
    return apiServerError(error);
  }
}
