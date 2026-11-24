import { NextRequest } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { rehostInboundMediaDetailed } from "@/lib/whatsapp/media";
import {
  apiSuccess,
  apiError,
  apiUnauthorized,
  apiForbidden,
  apiServerError,
} from "@/lib/api/response";

export const maxDuration = 60;

const bodySchema = z
  .object({
    since_days: z.number().int().min(1).max(30).default(7),
    limit: z.number().int().min(1).max(30).default(20),
  })
  .default({ since_days: 7, limit: 20 });

/**
 * Reprocessa mídias recebidas que ficaram com o link criptografado do WhatsApp
 * (mmg.whatsapp.net) porque a re-hospedagem falhou na entrada. Admin/manager.
 *   POST /api/whatsapp/media/rehost   { since_days?: 7, limit?: 20 }
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireRole(["admin", "manager"]);
    const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return apiError("Validation failed", 400, parsed.error.flatten());
    const { since_days, limit } = parsed.data;

    const supabase = createAdminClient();
    const since = new Date(Date.now() - since_days * 86_400_000).toISOString();
    const { data: rows, error } = await supabase
      .from("whatsapp_messages")
      .select(
        "id, conversation_id, external_id, metadata, whatsapp_conversations!inner(company_id, whatsapp_lines!inner(provider, provider_instance, provider_token))",
      )
      .like("media_url", "%mmg.whatsapp.net%")
      .not("external_id", "is", null)
      .gte("created_at", since)
      .eq("whatsapp_conversations.company_id", user.company_id)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) return apiError(error.message, 500);

    type Row = {
      id: string;
      conversation_id: string;
      external_id: string;
      metadata: Record<string, unknown> | null;
      whatsapp_conversations: {
        whatsapp_lines: { provider: string; provider_instance: string | null; provider_token: string | null };
      };
    };

    const results: { id: string; ok: boolean; error?: string }[] = [];
    for (const r of (rows ?? []) as unknown as Row[]) {
      const line = r.whatsapp_conversations.whatsapp_lines;
      if (line.provider !== "evolution" || !line.provider_instance) continue;
      const out = await rehostInboundMediaDetailed({
        externalId: r.external_id,
        conversationId: r.conversation_id,
        instance: line.provider_instance,
        apiKey: line.provider_token || undefined,
      });
      if ("error" in out) {
        await (supabase.from("whatsapp_messages") as any) // eslint-disable-line @typescript-eslint/no-explicit-any
          .update({ metadata: { ...(r.metadata ?? {}), media_rehost_error: out.error } })
          .eq("id", r.id);
        results.push({ id: r.id, ok: false, error: out.error });
      } else {
        const meta = { ...(r.metadata ?? {}) };
        delete meta.media_rehost_error;
        await (supabase.from("whatsapp_messages") as any) // eslint-disable-line @typescript-eslint/no-explicit-any
          .update({ media_url: out.url, media_mime_type: out.mime, metadata: meta })
          .eq("id", r.id);
        results.push({ id: r.id, ok: true });
      }
    }

    return apiSuccess({
      checked: results.length,
      fixed: results.filter((x) => x.ok).length,
      failed: results.filter((x) => !x.ok),
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    if (error instanceof Error && error.message === "Forbidden") return apiForbidden();
    return apiServerError(error);
  }
}
