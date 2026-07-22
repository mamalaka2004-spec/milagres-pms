/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { logActivity } from "@/lib/audit/log";
import { createAdminClient } from "@/lib/supabase/admin";
import { apiSuccess, apiError, apiUnauthorized, apiForbidden, apiNotFound, apiServerError } from "@/lib/api/response";

type Params = { params: Promise<{ id: string }> };

const schema = z.object({ warmup_enabled: z.boolean() });

/**
 * Liga/desliga o warmup (rampa antiban p/ número novo) da linha. Ao ligar,
 * warmup_start_date = hoje se ainda não houver; ao desligar, a data é mantida
 * (religar não reinicia a rampa do zero por engano).
 */
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const user = await requireRole(["admin", "manager"]);
    const { id } = await params;
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) return apiError("Dados inválidos", 400, parsed.error.flatten());

    const db = createAdminClient();
    const { data: line } = await (db.from("whatsapp_lines") as any)
      .select("id, company_id, label, warmup_enabled, warmup_start_date")
      .eq("id", id)
      .maybeSingle();
    if (!line) return apiNotFound("Linha");
    if (line.company_id !== user.company_id) return apiForbidden();

    const patch: Record<string, unknown> = { warmup_enabled: parsed.data.warmup_enabled };
    if (parsed.data.warmup_enabled && !line.warmup_start_date) {
      patch.warmup_start_date = new Date().toISOString().slice(0, 10);
    }
    const { data: updated, error } = await (db.from("whatsapp_lines") as any)
      .update(patch)
      .eq("id", id)
      .select("id, warmup_enabled, warmup_start_date")
      .single();
    if (error) throw error;

    await logActivity({ user, action: "line.warmup", entityType: "whatsapp_line", entityId: id, details: { label: line.label, warmup_enabled: parsed.data.warmup_enabled } });
    return apiSuccess(updated);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    if (error instanceof Error && error.message === "Forbidden") return apiForbidden();
    return apiServerError(error);
  }
}
