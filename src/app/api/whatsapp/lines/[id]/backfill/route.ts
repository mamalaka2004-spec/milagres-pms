import { NextRequest } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  findChats,
  findMessages,
  decodeMessage,
  jidToPhoneE164,
} from "@/lib/whatsapp/evolution";
import {
  appendMessage,
  findOrCreateConversation,
} from "@/lib/db/queries/whatsapp";
import {
  apiSuccess,
  apiError,
  apiUnauthorized,
  apiForbidden,
  apiNotFound,
  apiServerError,
} from "@/lib/api/response";
import type { Database } from "@/types/database";

type LineRow = Database["public"]["Tables"]["whatsapp_lines"]["Row"];

const bodySchema = z.object({
  limit_per_chat: z.number().int().min(1).max(500).default(200),
  max_chats: z.number().int().min(1).max(500).default(100),
  since_days: z.number().int().min(1).max(365).optional(),
}).default({ limit_per_chat: 200, max_chats: 100 });

interface Params {
  params: Promise<{ id: string }>;
}

export const maxDuration = 60; // matches vercel.json: heavy import

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const user = await requireRole(["admin", "manager"]);
    const { id: lineId } = await params;

    const supabase = createAdminClient();
    const { data: lineData } = await supabase
      .from("whatsapp_lines")
      .select("*")
      .eq("id", lineId)
      .maybeSingle();
    const line = lineData as LineRow | null;
    if (!line) return apiNotFound("Line");
    if (line.company_id !== user.company_id) return apiForbidden();

    const body = await req.json().catch(() => ({}));
    const validation = bodySchema.safeParse(body);
    if (!validation.success) return apiError("Validation failed", 400, validation.error.flatten());
    const opts = validation.data;
    const sinceMs = opts.since_days ? Date.now() - opts.since_days * 86_400_000 : null;

    const instance = line.provider_instance || undefined;

    let chats;
    try {
      chats = await findChats(instance);
    } catch (e) {
      return apiError(`Evolution findChats failed: ${e instanceof Error ? e.message : String(e)}`, 502);
    }

    let conversationsTouched = 0;
    let messagesImported = 0;
    let messagesSkipped = 0;
    const chatErrors: Array<{ jid: string; error: string }> = [];

    const chatLimit = chats.slice(0, opts.max_chats);
    for (const chat of chatLimit) {
      const phone = jidToPhoneE164(chat.remoteJid);
      if (!phone) continue;
      // Skip group chats (jid contains @g.us) — only 1:1 contacts
      if (chat.remoteJid.endsWith("@g.us")) continue;

      let messages;
      try {
        messages = await findMessages(chat.remoteJid, instance, opts.limit_per_chat);
      } catch (e) {
        chatErrors.push({ jid: chat.remoteJid, error: e instanceof Error ? e.message : String(e) });
        continue;
      }
      if (messages.length === 0) continue;

      const conv = await findOrCreateConversation({
        companyId: line.company_id,
        lineId: line.id,
        contactPhone: phone,
        contactName: chat.pushName ?? null,
      });
      conversationsTouched++;

      // Sort oldest-first so timestamps in DB also flow chronologically
      const sorted = messages.slice().sort((a, b) => {
        const at = Number(a.messageTimestamp || 0);
        const bt = Number(b.messageTimestamp || 0);
        return at - bt;
      });

      // Bulk dedup pre-check: ask DB which external_ids we already have for this conversation.
      const externalIds = sorted.map((m) => m.key?.id).filter((x): x is string => !!x);
      const existing = new Set<string>();
      if (externalIds.length > 0) {
        const { data: dup } = await supabase
          .from("whatsapp_messages")
          .select("external_id")
          .eq("conversation_id", conv.id)
          .in("external_id", externalIds);
        for (const r of (dup as { external_id: string }[]) || []) existing.add(r.external_id);
      }

      for (const m of sorted) {
        const tsMs = Number(m.messageTimestamp || 0) * 1000;
        if (sinceMs && tsMs && tsMs < sinceMs) continue;
        if (!m.key?.id) continue;
        if (existing.has(m.key.id)) {
          messagesSkipped++;
          continue;
        }

        const decoded = decodeMessage(m);
        const fromMe = !!m.key.fromMe;

        try {
          await appendMessage({
            conversationId: conv.id,
            direction: fromMe ? "outbound" : "inbound",
            sender: fromMe ? "ai" : "guest",
            text: decoded.text,
            messageType: decoded.messageType,
            mediaMimeType: decoded.mediaMimeType,
            fileName: decoded.fileName,
            externalId: m.key.id,
            status: "sent",
            metadata: { backfill: true, source: "evolution_history", ts: tsMs || null } as never,
          });
          messagesImported++;
        } catch {
          messagesSkipped++;
        }
      }
    }

    return apiSuccess({
      chats_found: chats.length,
      chats_processed: conversationsTouched,
      messages_imported: messagesImported,
      messages_skipped_or_dup: messagesSkipped,
      chat_errors: chatErrors,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    if (error instanceof Error && error.message === "Forbidden") return apiForbidden();
    if (error instanceof Error && error.message.includes("Evolution API not configured")) {
      return apiError("Evolution env vars missing on the server. Set EVOLUTION_API_URL + EVOLUTION_API_KEY + (line) provider_instance.", 503);
    }
    return apiServerError(error);
  }
}
