/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest } from "next/server";
import { z } from "zod";
import { requireFullAccess, requireRole } from "@/lib/auth";
import { logActivity } from "@/lib/audit/log";
import { createAdminClient } from "@/lib/supabase/admin";
import { apiSuccess, apiError, apiUnauthorized, apiForbidden, apiServerError } from "@/lib/api/response";

/**
 * Auditoria da organização de nomes: o que mudou, de onde veio e como reverter.
 *
 * O "antes" é `raw_label` — o rótulo original da importação, que nunca é
 * sobrescrito. Comparando com `display_name` sabemos exatamente quais contatos
 * foram alterados, mesmo os que foram organizados fora da interface.
 */
export async function GET(req: NextRequest) {
  try {
    const user = await requireFullAccess();
    const sp = req.nextUrl.searchParams;
    const source = sp.get("source"); // heuristic | ai | manual
    const confidence = sp.get("confidence"); // alta | media | baixa
    const limit = Math.min(Number(sp.get("limit") ?? 100), 300);
    const offset = Math.max(Number(sp.get("offset") ?? 0), 0);

    const db = createAdminClient();
    let q = (db.from("whatsapp_contacts") as any)
      .select(
        "id, raw_label, display_name, first_name, last_name, social_name, instagram_handle, unit_hint, category, name_source, name_confidence, name_reviewed_at, phone_e164",
        { count: "exact" }
      )
      .eq("company_id", user.company_id)
      .not("name_source", "is", null);
    if (source) q = q.eq("name_source", source);
    if (confidence) q = q.eq("name_confidence", confidence);

    const { data, count, error } = await q
      .order("name_confidence", { ascending: true })
      .order("display_name", { ascending: true, nullsFirst: false })
      .range(offset, offset + limit - 1);
    if (error) throw error;

    const rows = ((data as any[]) || []).map((r) => ({
      ...r,
      // Mudou de fato? (raw_label ausente = contato criado já organizado)
      changed: !!r.raw_label && r.raw_label !== r.display_name,
      can_revert: !!r.raw_label && r.raw_label !== r.display_name,
    }));

    // Resumo geral (independente da paginação) para os cartões do topo.
    const { data: allRows } = await (db.from("whatsapp_contacts") as any)
      .select("raw_label, display_name, name_source, name_confidence, first_name")
      .eq("company_id", user.company_id)
      .limit(5000);
    const all = (allRows as any[]) || [];
    const summary = {
      total: all.length,
      alterados: all.filter((r) => r.raw_label && r.raw_label !== r.display_name).length,
      por_ia: all.filter((r) => r.name_source === "ai").length,
      por_regra: all.filter((r) => r.name_source === "heuristic").length,
      alta: all.filter((r) => r.name_confidence === "alta").length,
      media: all.filter((r) => r.name_confidence === "media").length,
      baixa: all.filter((r) => r.name_confidence === "baixa").length,
      com_primeiro_nome: all.filter((r) => !!r.first_name).length,
    };

    return apiSuccess({ changes: rows, total: count ?? rows.length, summary });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    if (error instanceof Error && error.message === "Forbidden") return apiForbidden();
    return apiServerError(error);
  }
}

const revertSchema = z.object({ contact_ids: z.array(z.string().uuid()).min(1).max(500) });

/** Reverte para o nome original (raw_label) e reabre a revisão. */
export async function POST(req: NextRequest) {
  try {
    const user = await requireRole(["admin", "manager"]);
    const parsed = revertSchema.safeParse(await req.json());
    if (!parsed.success) return apiError("Dados inválidos", 400, parsed.error.flatten());

    const db = createAdminClient();
    const { data: rows } = await (db.from("whatsapp_contacts") as any)
      .select("id, raw_label")
      .eq("company_id", user.company_id)
      .in("id", parsed.data.contact_ids)
      .not("raw_label", "is", null);

    const updates = ((rows as { id: string; raw_label: string }[]) || []).map((r) =>
      (db.from("whatsapp_contacts") as any)
        .update({
          display_name: r.raw_label,
          first_name: null,
          last_name: null,
          name_confidence: null,
          name_source: null,
          name_reviewed_at: null,
        })
        .eq("id", r.id)
        .eq("company_id", user.company_id)
    );
    for (let i = 0; i < updates.length; i += 25) await Promise.all(updates.slice(i, i + 25));

    await logActivity({
      user,
      action: "contact.revert_name",
      entityType: "whatsapp_contact",
      details: { count: updates.length },
    });
    return apiSuccess({ reverted: updates.length });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    if (error instanceof Error && error.message === "Forbidden") return apiForbidden();
    return apiServerError(error);
  }
}
