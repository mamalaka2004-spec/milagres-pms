/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { logActivity } from "@/lib/audit/log";
import { createAdminClient } from "@/lib/supabase/admin";
import { addMembers } from "@/lib/db/queries/contact-lists";
import { apiSuccess, apiError, apiUnauthorized, apiForbidden, apiServerError } from "@/lib/api/response";

/** Ações em massa sobre contatos selecionados na lista. */
const bodySchema = z.object({
  contact_ids: z.array(z.string().uuid()).min(1).max(1000),
  action: z.enum([
    "set_category",
    "add_tags",
    "remove_tags",
    "set_rating",
    "set_do_not_contact",
    "add_to_list",
    "apply_names",
    "delete",
  ]),
  category: z.string().max(30).nullable().optional(),
  tags: z.array(z.string().min(1).max(40)).max(20).optional(),
  rating: z.number().int().min(1).max(5).nullable().optional(),
  do_not_contact: z.boolean().optional(),
  list_id: z.string().uuid().optional(),
  /** apply_names: nomes revisados vindos da tela de organização. */
  names: z
    .array(
      z.object({
        id: z.string().uuid(),
        first_name: z.string().max(80).nullable().optional(),
        last_name: z.string().max(120).nullable().optional(),
        social_name: z.string().max(80).nullable().optional(),
        display_name: z.string().max(160).nullable().optional(),
      })
    )
    .max(1000)
    .optional(),
  /** apply_names: marca como revisados SEM alterar nome (casos sem solução —
   *  evita que voltem para a fila de revisão a cada análise). */
  mark_reviewed_ids: z.array(z.string().uuid()).max(1000).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const user = await requireRole(["admin", "manager"]);
    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) return apiError("Dados inválidos", 400, parsed.error.flatten());
    const { contact_ids: ids, action } = parsed.data;

    const db = createAdminClient();
    let affected = ids.length;

    switch (action) {
      case "set_category": {
        const { error } = await (db.from("whatsapp_contacts") as any)
          .update({ category: parsed.data.category ?? null })
          .eq("company_id", user.company_id)
          .in("id", ids);
        if (error) throw error;
        break;
      }
      case "set_rating": {
        const { error } = await (db.from("whatsapp_contacts") as any)
          .update({ rating: parsed.data.rating ?? null })
          .eq("company_id", user.company_id)
          .in("id", ids);
        if (error) throw error;
        break;
      }
      case "set_do_not_contact": {
        const dnc = parsed.data.do_not_contact === true;
        const { error } = await (db.from("whatsapp_contacts") as any)
          .update({
            do_not_contact: dnc,
            opted_out_at: dnc ? new Date().toISOString() : null,
            opt_out_source: dnc ? "manual" : null,
          })
          .eq("company_id", user.company_id)
          .in("id", ids);
        if (error) throw error;
        break;
      }
      case "add_tags":
      case "remove_tags": {
        const tags = (parsed.data.tags ?? []).map((t) => t.trim().toLowerCase()).filter(Boolean);
        if (tags.length === 0) return apiError("Informe ao menos 1 tag", 400);
        // Array de tags é por linha — lê, mescla e grava em lotes.
        const { data: rows, error } = await (db.from("whatsapp_contacts") as any)
          .select("id, tags")
          .eq("company_id", user.company_id)
          .in("id", ids);
        if (error) throw error;
        const updates = ((rows as { id: string; tags: string[] }[]) || []).map((r) => {
          const cur = new Set(r.tags ?? []);
          for (const t of tags) (action === "add_tags" ? cur.add(t) : cur.delete(t));
          return (db.from("whatsapp_contacts") as any)
            .update({ tags: [...cur] })
            .eq("id", r.id)
            .eq("company_id", user.company_id);
        });
        for (let i = 0; i < updates.length; i += 25) await Promise.all(updates.slice(i, i + 25));
        affected = updates.length;
        break;
      }
      case "add_to_list": {
        if (!parsed.data.list_id) return apiError("Selecione a lista", 400);
        const { data: list } = await (db.from("contact_lists") as any)
          .select("id")
          .eq("id", parsed.data.list_id)
          .eq("company_id", user.company_id)
          .maybeSingle();
        if (!list) return apiError("Lista não encontrada", 404);
        await addMembers(parsed.data.list_id, ids);
        break;
      }
      case "apply_names": {
        const names = parsed.data.names ?? [];
        const markOnly = parsed.data.mark_reviewed_ids ?? [];
        if (names.length === 0 && markOnly.length === 0) return apiError("Nada para aplicar", 400);
        const now = new Date().toISOString();
        if (markOnly.length > 0) {
          const { error } = await (db.from("whatsapp_contacts") as any)
            .update({ name_reviewed_at: now })
            .eq("company_id", user.company_id)
            .in("id", markOnly);
          if (error) throw error;
        }
        if (names.length === 0) {
          affected = markOnly.length;
          break;
        }
        const updates = names.map((n) =>
          (db.from("whatsapp_contacts") as any)
            .update({
              first_name: n.first_name ?? null,
              last_name: n.last_name ?? null,
              social_name: n.social_name ?? null,
              // display_name só é sobrescrito quando há um nome novo válido.
              ...(n.display_name?.trim() ? { display_name: n.display_name.trim() } : {}),
              name_reviewed_at: now,
            })
            .eq("id", n.id)
            .eq("company_id", user.company_id)
        );
        for (let i = 0; i < updates.length; i += 25) await Promise.all(updates.slice(i, i + 25));
        affected = names.length + markOnly.length;
        break;
      }
      case "delete": {
        const { error } = await (db.from("whatsapp_contacts") as any)
          .delete()
          .eq("company_id", user.company_id)
          .in("id", ids);
        if (error) throw error;
        break;
      }
    }

    await logActivity({
      user,
      action: `contact.bulk.${action}`,
      entityType: "whatsapp_contact",
      details: { count: affected },
    });
    return apiSuccess({ affected, action });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    if (error instanceof Error && error.message === "Forbidden") return apiForbidden();
    return apiServerError(error);
  }
}
