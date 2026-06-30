import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { logActivity } from "@/lib/audit/log";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  apiSuccess,
  apiError,
  apiUnauthorized,
  apiServerError,
} from "@/lib/api/response";

export async function GET() {
  try {
    const user = await requireAuth();
    const supabase = createAdminClient();
    const { data, error } = await (supabase.from("whatsapp_quick_replies") as any) // eslint-disable-line @typescript-eslint/no-explicit-any
      .select("id, title, body, shortcut, category")
      .eq("company_id", user.company_id)
      .order("category", { ascending: true, nullsFirst: true })
      .order("title", { ascending: true });
    // Table may not exist yet (migration 008 not run) — degrade to empty list.
    if (error) return apiSuccess([]);
    return apiSuccess(data || []);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    return apiServerError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await req.json();
    const title = String(body?.title || "").trim();
    const text = String(body?.body || "").trim();
    if (!title || !text) return apiError("Título e texto são obrigatórios", 400);

    const supabase = createAdminClient();
    const { data, error } = await (supabase.from("whatsapp_quick_replies") as any) // eslint-disable-line @typescript-eslint/no-explicit-any
      .insert({
        company_id: user.company_id,
        title,
        body: text,
        shortcut: body?.shortcut?.trim() || null,
        category: body?.category?.trim() || null,
        created_by: user.id,
      })
      .select("id, title, body, shortcut, category")
      .single();
    if (error) return apiError(error.message, 400);
    await logActivity({ user, action: "quick_reply.create", entityType: "quick_reply", entityId: (data as { id?: string } | null)?.id ?? null, details: { label: title } });
    return apiSuccess(data);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    return apiServerError(error);
  }
}
