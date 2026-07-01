import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { apiSuccess, apiError } from "@/lib/api/response";
import { listRecipients, setCampaignStatus } from "@/lib/db/queries/campaign";
import type { Campaign } from "@/types/campaign";

/**
 * Polling do n8n (cron) para campanhas AGENDADAS que já venceram. Autenticado por
 * `x-webhook-secret`. Marca cada campanha como "sending" e devolve o payload de
 * disparo (linha + destinatários pendentes) — mesmo formato do webhook de /send.
 */
function appUrl(): string | undefined {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return undefined;
}

export async function GET(request: NextRequest) {
  const expected = process.env.WHATSAPP_WEBHOOK_SECRET;
  const provided = request.headers.get("x-webhook-secret") || "";
  if (!expected || provided !== expected) return apiError("Unauthorized", 401);

  const supabase = createAdminClient();
  const nowIso = new Date().toISOString();
  const { data } = await (supabase.from("campaigns") as any) // eslint-disable-line @typescript-eslint/no-explicit-any
    .select("*")
    .eq("status", "scheduled")
    .lte("scheduled_at", nowIso)
    .limit(20);
  const due = (data as Campaign[]) || [];
  const base = appUrl();
  const out: unknown[] = [];

  for (const campaign of due) {
    if (!campaign.line_id) {
      await setCampaignStatus(campaign.id, "failed", { finished_at: nowIso });
      continue;
    }
    const { data: line } = await (supabase.from("whatsapp_lines") as any) // eslint-disable-line @typescript-eslint/no-explicit-any
      .select("id, phone, provider, provider_instance, provider_token")
      .eq("id", campaign.line_id)
      .maybeSingle();
    const recipients = (await listRecipients(campaign.id))
      .filter((r) => r.status === "pending")
      .map((r) => ({ id: r.id, phone_e164: r.phone_e164, phone_canonical: r.phone_canonical, name: r.name }));
    if (!line || recipients.length === 0) {
      await setCampaignStatus(campaign.id, "failed", { finished_at: nowIso });
      continue;
    }
    await setCampaignStatus(campaign.id, "sending", { started_at: nowIso, scheduled_at: null });
    out.push({
      campaign_id: campaign.id,
      callback_url: base ? `${base}/api/webhooks/campaigns/status` : undefined,
      message_template: campaign.message_template,
      media_url: campaign.media_url,
      media_mime_type: campaign.media_mime_type,
      throttle_seconds: campaign.throttle_seconds,
      line: {
        phone: line.phone,
        provider: line.provider,
        provider_instance: line.provider_instance,
        provider_token: line.provider_token,
      },
      recipients,
    });
  }

  return apiSuccess({ campaigns: out });
}
