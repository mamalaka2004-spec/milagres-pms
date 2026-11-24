import { NextRequest } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { findContactsRaw, findMessages, isLidJid, jidToPhoneE164, phoneFromKey } from "@/lib/whatsapp/evolution";
import { canonicalBR } from "@/lib/whatsapp/phone";
import {
  apiSuccess,
  apiError,
  apiUnauthorized,
  apiForbidden,
  apiNotFound,
  apiServerError,
} from "@/lib/api/response";

export const maxDuration = 60;

interface Params {
  params: Promise<{ id: string }>;
}

const bodySchema = z
  .object({
    apply: z.boolean().default(false),
    delete_empty: z.boolean().default(false),
    limit: z.number().int().min(1).max(60).default(30),
    offset: z.number().int().min(0).default(0),
  })
  .default({ apply: false, delete_empty: false, limit: 30, offset: 0 });

type Conv = {
  id: string;
  contact_phone: string;
  contact_name: string | null;
  last_message_at: string | null;
  last_message_text: string | null;
  unread_count: number | null;
};

function isRealName(n: string | null | undefined): boolean {
  const s = (n || "").trim();
  return !!s && !/^[+\d\s()\-]+$/.test(s);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyTable = any;

/**
 * Conversas cujo contact_phone é um identificador de privacidade (@lid, 14-15 dígitos)
 * em vez do telefone. Para cada uma, descobre o telefone real e o nome (pushName) no
 * Evolution e:
 *   - se já existe conversa com esse telefone na linha → junta tudo nela e apaga a do LID;
 *   - senão → troca o contact_phone pelo telefone real.
 * apply=false (padrão) só relata o que faria. Admin/manager.
 *   POST /api/whatsapp/lines/:id/repair-lid  { apply?: false, limit?: 30, offset?: 0 }
 */
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const user = await requireRole(["admin", "manager"]);
    const { id: lineId } = await params;
    const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return apiError("Validation failed", 400, parsed.error.flatten());
    const { apply, delete_empty, limit, offset } = parsed.data;

    const supabase = createAdminClient();
    const { data: lineData } = await supabase.from("whatsapp_lines").select("*").eq("id", lineId).maybeSingle();
    const line = lineData as { id: string; company_id: string; provider_instance: string | null } | null;
    if (!line) return apiNotFound("Line");
    if (line.company_id !== user.company_id) return apiForbidden();
    const instance = line.provider_instance || undefined;

    // Lê TODAS as conversas da linha (o PostgREST devolve no máximo 1000 por consulta).
    const convs: Conv[] = [];
    for (let from = 0; ; from += 1000) {
      const { data: page, error: convErr } = await supabase
        .from("whatsapp_conversations")
        .select("id, contact_phone, contact_name, last_message_at, last_message_text, unread_count")
        .eq("line_id", lineId)
        .order("created_at", { ascending: true })
        .order("id", { ascending: true })
        .range(from, from + 999);
      if (convErr) return apiError(convErr.message, 500);
      const rows = (page as Conv[]) || [];
      convs.push(...rows);
      if (rows.length < 1000) break;
    }

    const byCanon = new Map<string, Conv>();
    for (const c of convs) {
      if (isLidJid(c.contact_phone)) continue;
      const k = canonicalBR(c.contact_phone);
      if (k && !byCanon.has(k)) byCanon.set(k, c);
    }
    const lidConvs = convs.filter((c) => isLidJid(c.contact_phone));
    const slice = lidConvs.slice(offset, offset + limit);

    // Contatos do Evolution: alguns trazem o LID e o telefone juntos.
    const lidToPhone = new Map<string, string>();
    const lidToName = new Map<string, string>();
    const contactKeysSeen = new Set<string>();
    try {
      const contacts = await findContactsRaw(instance);
      for (const ct of contacts) {
        Object.keys(ct).forEach((k) => contactKeysSeen.add(k));
        const vals = Object.values(ct).filter((v): v is string => typeof v === "string");
        const lid = vals.find((v) => /@lid$/i.test(v));
        const pn = vals.find((v) => /@s\.whatsapp\.net$/i.test(v));
        const name = (ct.pushName as string) || (ct.name as string) || null;
        if (lid) {
          const d = lid.replace(/\D/g, "");
          if (pn) lidToPhone.set(d, jidToPhoneE164(pn)!);
          if (isRealName(name)) lidToName.set(d, name!.trim());
        }
      }
    } catch {
      // opcional
    }

    // Modo separado: apaga conversas @lid SEM nenhuma mensagem e sem negócio/campanha ligados.
    if (delete_empty) {
      const lidIds = lidConvs.map((c) => c.id);
      const empties: string[] = [];
      for (let i = 0; i < lidIds.length; i += 200) {
        const chunk = lidIds.slice(i, i + 200);
        const [{ data: withMsg }, { data: withDeal }, { data: withRec }] = await Promise.all([
          supabase.from("whatsapp_messages").select("conversation_id").in("conversation_id", chunk),
          supabase.from("funnel_deals").select("conversation_id").in("conversation_id", chunk),
          supabase.from("campaign_recipients").select("conversation_id").in("conversation_id", chunk),
        ]);
        const used = new Set<string>(
          [...((withMsg as { conversation_id: string }[]) || []),
           ...((withDeal as { conversation_id: string }[]) || []),
           ...((withRec as { conversation_id: string }[]) || [])].map((r) => r.conversation_id),
        );
        empties.push(...chunk.filter((id) => !used.has(id)));
      }
      let deleted = 0;
      if (apply) {
        for (let i = 0; i < empties.length; i += 200) {
          const chunk = empties.slice(i, i + 200);
          const { error } = await (supabase.from("whatsapp_conversations") as AnyTable).delete().in("id", chunk);
          if (!error) deleted += chunk.length;
        }
      }
      return apiSuccess({ apply, mode: "delete_empty", lid_conversations_total: lidConvs.length, empty_found: empties.length, deleted });
    }

    const keyFieldsSeen = new Set<string>();
    const report: Array<Record<string, unknown>> = [];
    let resolvedPhone = 0, resolvedName = 0, merged = 0, renamed = 0, unresolved = 0;

    for (const lc of slice) {
      const lidDigits = lc.contact_phone.replace(/\D/g, "");
      let phone: string | null = lidToPhone.get(lidDigits) || null;
      let name: string | null = lidToName.get(lidDigits) || null;

      if (!phone || !name) {
        try {
          const msgs = await findMessages(`${lidDigits}@lid`, instance, 25);
          for (const m of msgs) {
            const key = (m.key || {}) as unknown as Record<string, unknown>;
            Object.keys(key).forEach((k) => keyFieldsSeen.add(k));
            if (!phone) phone = phoneFromKey(key);
            if (!name && !key.fromMe && isRealName(m.pushName)) name = m.pushName!.trim();
            if (phone && name) break;
          }
        } catch (e) {
          report.push({ conv: lc.id, error: e instanceof Error ? e.message : String(e) });
        }
      }

      if (phone) resolvedPhone++;
      if (name) resolvedName++;
      const canon = phone ? canonicalBR(phone) : null;
      const target = canon ? byCanon.get(canon) : undefined;
      const action = !phone ? "sem_telefone" : target ? "juntar" : "trocar_numero";
      if (!phone) unresolved++;
      report.push({ conv: lc.id, lid: lidDigits, phone, name, action, target: target?.id ?? null });

      if (!apply) continue;

      if (target) {
        // Junta na conversa existente (com o telefone real).
        // Remove da conversa LID as mensagens que já existem no destino (mesmo external_id),
        // consultando a partir da conversa LID (pequena) para não bater no limite de 1000.
        const { data: lMsgs } = await supabase
          .from("whatsapp_messages")
          .select("external_id")
          .eq("conversation_id", lc.id)
          .not("external_id", "is", null)
          .range(0, 4999);
        const lIds = ((lMsgs as { external_id: string }[]) || []).map((r) => r.external_id);
        for (let i = 0; i < lIds.length; i += 200) {
          const chunk = lIds.slice(i, i + 200);
          const { data: dup } = await supabase
            .from("whatsapp_messages")
            .select("external_id")
            .eq("conversation_id", target.id)
            .in("external_id", chunk);
          const dupIds = ((dup as { external_id: string }[]) || []).map((r) => r.external_id);
          if (dupIds.length > 0) {
            await (supabase.from("whatsapp_messages") as AnyTable)
              .delete()
              .eq("conversation_id", lc.id)
              .in("external_id", dupIds);
          }
        }
        await (supabase.from("whatsapp_messages") as AnyTable).update({ conversation_id: target.id }).eq("conversation_id", lc.id);
        await (supabase.from("funnel_deals") as AnyTable).update({ conversation_id: target.id }).eq("conversation_id", lc.id);
        await (supabase.from("campaign_recipients") as AnyTable).update({ conversation_id: target.id }).eq("conversation_id", lc.id);

        const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
        if (lc.last_message_at && (!target.last_message_at || lc.last_message_at > target.last_message_at)) {
          patch.last_message_at = lc.last_message_at;
          patch.last_message_text = lc.last_message_text;
        }
        patch.unread_count = (target.unread_count || 0) + (lc.unread_count || 0);
        if (!isRealName(target.contact_name) && (name || isRealName(lc.contact_name))) {
          patch.contact_name = name || lc.contact_name;
        }
        await (supabase.from("whatsapp_conversations") as AnyTable).update(patch).eq("id", target.id);
        // tags / lead_data da conversa LID são apagados em cascata junto com ela
        await (supabase.from("whatsapp_conversations") as AnyTable).delete().eq("id", lc.id);
        merged++;
      } else if (phone) {
        const patch: Record<string, unknown> = { contact_phone: phone, updated_at: new Date().toISOString() };
        if (name && !isRealName(lc.contact_name)) patch.contact_name = name;
        const { error } = await (supabase.from("whatsapp_conversations") as AnyTable).update(patch).eq("id", lc.id);
        if (!error) {
          renamed++;
          if (canon) byCanon.set(canon, { ...lc, contact_phone: phone });
        }
      } else if (name && !isRealName(lc.contact_name)) {
        await (supabase.from("whatsapp_conversations") as AnyTable).update({ contact_name: name }).eq("id", lc.id);
      }
    }

    // Em apply, as conversas resolvidas saem da lista de LID; só as não resolvidas ficam.
    const stillLid = slice.length - merged - renamed;
    const nextOffset = apply
      ? offset + slice.length < lidConvs.length ? offset + stillLid : null
      : offset + limit < lidConvs.length ? offset + limit : null;

    return apiSuccess({
      apply,
      lid_conversations_total: lidConvs.length,
      checked: slice.length,
      phone_found: resolvedPhone,
      name_found: resolvedName,
      merged,
      renamed,
      unresolved,
      next_offset: nextOffset,
      evolution_contact_lid_map: lidToPhone.size,
      key_fields_seen: Array.from(keyFieldsSeen),
      contact_fields_seen: Array.from(contactKeysSeen).slice(0, 30),
      sample: report,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    if (error instanceof Error && error.message === "Forbidden") return apiForbidden();
    return apiServerError(error);
  }
}
