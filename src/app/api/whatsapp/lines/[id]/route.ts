import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  apiSuccess,
  apiError,
  apiUnauthorized,
  apiForbidden,
  apiNotFound,
  apiServerError,
} from "@/lib/api/response";
import { z } from "zod";
import type { Database } from "@/types/database";

type LineRow = Database["public"]["Tables"]["whatsapp_lines"]["Row"];

const patchSchema = z.object({
  label: z.string().min(1).max(40).optional(),
  ai_enabled: z.boolean().optional(),
  is_active: z.boolean().optional(),
  provider_instance: z.string().max(80).nullable().optional(),
  business_hours: z
    .record(
      z.enum(["mon", "tue", "wed", "thu", "fri", "sat", "sun"]),
      z
        .object({
          open: z.string().regex(/^[0-2][0-9]:[0-5][0-9]$/),
          close: z.string().regex(/^[0-2][0-9]:[0-5][0-9]$/),
        })
        .nullable()
    )
    .nullable()
    .optional(),
});

interface Params {
  params: Promise<{ id: string }>;
}

async function loadLine(id: string, companyId: string): Promise<LineRow | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("whatsapp_lines")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  const line = data as LineRow | null;
  if (!line) return null;
  if (line.company_id !== companyId) return null;
  return line;
}

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const user = await requireRole(["admin", "manager"]);
    const { id } = await params;
    const line = await loadLine(id, user.company_id);
    if (!line) return apiNotFound("Line");
    return apiSuccess(line);
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
    const line = await loadLine(id, user.company_id);
    if (!line) return apiNotFound("Line");

    const body = await req.json();
    const validation = patchSchema.safeParse(body);
    if (!validation.success) return apiError("Validation failed", 400, validation.error.flatten());

    const supabase = createAdminClient();
    const { data, error } = await (supabase.from("whatsapp_lines") as any) // eslint-disable-line @typescript-eslint/no-explicit-any
      .update({ ...validation.data, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return apiSuccess(data);
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
    const line = await loadLine(id, user.company_id);
    if (!line) return apiNotFound("Line");

    const supabase = createAdminClient();
    // Cascade: whatsapp_line_users + whatsapp_conversations (+ messages, lead_data)
    // are wired with ON DELETE CASCADE, so a single delete tears down the tree.
    const { error } = await supabase.from("whatsapp_lines").delete().eq("id", id);
    if (error) throw error;
    return apiSuccess({ deleted: true });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    if (error instanceof Error && error.message === "Forbidden") return apiForbidden();
    return apiServerError(error);
  }
}
