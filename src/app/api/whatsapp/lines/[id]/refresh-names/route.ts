import { NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { findChats, findContacts, jidToPhoneE164 } from "@/lib/whatsapp/evolution";
import { canonicalBR } from "@/lib/whatsapp/phone";
import { apiSuccess, apiError, apiNotFound, apiServerError } from "@/lib/api/response";
import type { Database } from "@/types/database";

type LineRow = Database["public"]["Tables"]["whatsapp_lines"]["Row"];

interface Params { params: Promise<{ id: string }> }

export const maxDuration = 60;

function isRealName(n: string | null | undefined): boolean {
  const s = (n || "").trim();
  return !!s && !/^[+\d\s()\-]+$/.test(s);
}
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a); const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

/**
 * Pulls WhatsApp profile names (pushName) from Evolution for this line's instance and
 * fills conversation.contact_name where it's currently empty/numeric. Also updates the
 * matching whatsapp_contacts.display_name when blank. Secret-protected (x-webhook-secret).
 */
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const expected = process.env.WHATSAPP_WEBHOOK_SECRET;
    if (!expected) return apiError("Webhook not configured", 503);
    if (!safeEqual(req.headers.get("x-webhook-secret") || "", expected)) return apiError("Forbidden", 403);

    const { id } = await params;
    const supabase = createAdminClient();

    const { data: lineData } = await supabase.from("whatsapp_lines").select("*").eq("id", id).maybeSingle();
    const line = lineData as LineRow | null;
    if (!line) return apiNotFound("Line");

    const instance = line.provider_instance || undefined;

    // Build canonical → name map from chats + contacts.
    const nameByCanon = new Map<string, string>();
    const add = (jid: string, name: string | null | undefined) => {
      if (!isRealName(name)) return;
      const key = canonicalBR(jidToPhoneE164(jid) || jid);
      if (key && !nameByCanon.has(key)) nameByCanon.set(key, name!.trim());
    };
    try {
      const chats = await findChats(instance);
      for (const c of chats) add(c.remoteJid, c.pushName);
    } catch (e) {
      return apiError(`Evolution findChats falhou: ${e instanceof Error ? e.message : String(e)}`, 502);
    }
    try {
      const contacts = await findContacts(instance);
      for (const c of contacts) add(c.remoteJid, c.pushName);
    } catch {
      // findContacts optional — continue with chat names only
    }

    // Conversations of this line.
    const { data: convData } = await supabase
      .from("whatsapp_conversations")
      .select("id, contact_name, contact_phone")
      .eq("line_id", id);
    const convs = (convData as Array<{ id: string; contact_name: string | null; contact_phone: string }>) || [];

    let updated = 0;
    for (const cv of convs) {
      if (isRealName(cv.contact_name)) continue;
      const key = canonicalBR(cv.contact_phone);
      const name = key ? nameByCanon.get(key) : undefined;
      if (!name) continue;
      const { error } = await (supabase.from("whatsapp_conversations") as any) // eslint-disable-line @typescript-eslint/no-explicit-any
        .update({ contact_name: name }).eq("id", cv.id);
      if (!error) {
        updated++;
        // also fill the phonebook display_name when blank
        await (supabase.from("whatsapp_contacts") as any) // eslint-disable-line @typescript-eslint/no-explicit-any
          .update({ display_name: name })
          .eq("company_id", line.company_id)
          .eq("phone_canonical", key)
          .is("display_name", null);
      }
    }

    return apiSuccess({
      line: line.label,
      names_from_evolution: nameByCanon.size,
      conversations: convs.length,
      names_filled: updated,
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes("Evolution API not configured"))
      return apiError("Evolution não configurada no servidor.", 503);
    return apiServerError(error);
  }
}
