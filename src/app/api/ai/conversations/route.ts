import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { listMessages } from "@/lib/ai/conversations";
import { requireAuth } from "@/lib/auth";
import {
  apiSuccess,
  apiUnauthorized,
  apiServerError,
  apiNotFound,
  apiForbidden,
} from "@/lib/api/response";

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const supabase = createAdminClient();

    if (id) {
      const { data, error } = await supabase
        .from("ai_conversations")
        .select("*")
        .eq("id", id)
        .single();
      if (error) return apiNotFound("Conversation");
      const conv = data as { id: string; company_id: string };
      if (conv.company_id !== user.company_id) return apiForbidden();
      const messages = await listMessages(id);
      return apiSuccess({
        conversation: data,
        messages: messages
          .filter((m) => m.role === "user" || m.role === "assistant")
          .map((m) => ({ id: m.id, role: m.role, content: m.content, created_at: m.created_at })),
      });
    }

    const { data, error } = await supabase
      .from("ai_conversations")
      .select("id, mode, title, created_at, updated_at")
      .eq("company_id", user.company_id)
      .order("updated_at", { ascending: false })
      .limit(20);
    if (error) throw error;
    return apiSuccess(data || []);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    return apiServerError(error);
  }
}
