/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { logActivity } from "@/lib/audit/log";
import { createAdminClient } from "@/lib/supabase/admin";
import { createContactList, addMembers } from "@/lib/db/queries/contact-lists";
import { apiSuccess, apiError, apiUnauthorized, apiForbidden, apiServerError } from "@/lib/api/response";

/**
 * Atalho da página Contatos: transforma uma seleção numa campanha rascunho.
 * Cria (ou reusa) uma lista com os contatos e uma campanha 'draft' apontando
 * para ela via audience.list_ids. A UI então navega para /campaigns?edit=<id>
 * onde o compositor abre para escrever mensagens e configurar antiban.
 *
 * `create_campaign=false` cria só a lista (atalho "Nova lista").
 */
const bodySchema = z.object({
  contact_ids: z.array(z.string().uuid()).min(1).max(5000),
  list_name: z.string().min(2).max(120),
  create_campaign: z.boolean().default(true),
});

export async function POST(req: NextRequest) {
  try {
    const user = await requireRole(["admin", "manager"]);
    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) return apiError("Dados inválidos", 400, parsed.error.flatten());
    const { contact_ids: ids, list_name, create_campaign } = parsed.data;

    const list = await createContactList(user.company_id, user.id, { name: list_name });
    const memberCount = await addMembers(list.id, ids);

    if (!create_campaign) {
      await logActivity({ user, action: "contact_list.create", entityType: "contact_list", entityId: list.id, details: { label: list.name, members: memberCount } });
      return apiSuccess({ list_id: list.id, member_count: memberCount, campaign_id: null });
    }

    // Linha de vendas padrão para a campanha (o usuário troca no compositor).
    const db = createAdminClient();
    const { data: line } = await (db.from("whatsapp_lines") as any)
      .select("id")
      .eq("company_id", user.company_id)
      .eq("purpose", "sales")
      .eq("is_active", true)
      .order("created_at")
      .limit(1)
      .maybeSingle();

    const { data: created, error } = await (db.from("campaigns") as any)
      .insert({
        company_id: user.company_id,
        name: list_name,
        line_id: line?.id ?? null,
        message_template: "",
        status: "draft",
        audience: { list_ids: [list.id] },
        created_by: user.id,
      })
      .select("id")
      .single();
    if (error) throw error;

    await logActivity({ user, action: "campaign.create", entityType: "campaign", entityId: created.id, details: { label: list_name, from: "contacts_selection", members: memberCount } });
    return apiSuccess({ list_id: list.id, member_count: memberCount, campaign_id: created.id });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    if (error instanceof Error && error.message === "Forbidden") return apiForbidden();
    return apiServerError(error);
  }
}
