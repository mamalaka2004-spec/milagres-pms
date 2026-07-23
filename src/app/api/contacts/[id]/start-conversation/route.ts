/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest } from "next/server";
import { z } from "zod";
import { requireFullAccess } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { findOrCreateConversation, listLinesForUser } from "@/lib/db/queries/whatsapp";
import { canonicalBR } from "@/lib/whatsapp/phone";
import { apiSuccess, apiError, apiUnauthorized, apiForbidden, apiNotFound, apiServerError } from "@/lib/api/response";

type Params = { params: Promise<{ id: string }> };

const bodySchema = z.object({ line_id: z.string().uuid().optional() });

/**
 * Abre o chat interno de um contato SEM duplicar conversa. Procura uma conversa
 * existente por telefone em QUALQUER linha de vendas da empresa; se achar, abre
 * essa. Só cria nova (na linha escolhida ou na 1ª linha de vendas) quando não
 * houver nenhuma. Devolve { conversation_id, line_id, created }.
 */
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const user = await requireFullAccess();
    const { id } = await params;
    const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return apiError("Dados inválidos", 400, parsed.error.flatten());

    const db = createAdminClient();
    const { data: contact } = await (db.from("whatsapp_contacts") as any)
      .select("id, company_id, phone_e164, phone_canonical, display_name")
      .eq("id", id)
      .eq("company_id", user.company_id)
      .maybeSingle();
    if (!contact) return apiNotFound("Contato");
    if (!contact.phone_e164 && !contact.phone_canonical) {
      return apiError("Contato sem telefone válido", 400);
    }

    // Linhas de vendas às quais o usuário tem acesso.
    const lines = (await listLinesForUser(user.id, user.company_id)).filter(
      (l: any) => l.purpose === "sales" && l.is_active
    );
    if (lines.length === 0) return apiError("Nenhuma linha de vendas conectada", 409);
    const salesLineIds = lines.map((l: any) => l.id);

    // Dedupe: conversa já existente com este contato em qualquer linha de vendas.
    const canonical = contact.phone_canonical || canonicalBR(contact.phone_e164);
    const phoneVariants = [
      contact.phone_e164,
      contact.phone_e164?.startsWith("+") ? contact.phone_e164.slice(1) : `+${contact.phone_e164}`,
    ].filter(Boolean);
    let existing: { id: string; line_id: string } | null = null;
    const { data: convs } = await (db.from("whatsapp_conversations") as any)
      .select("id, line_id, contact_phone, last_message_at")
      .in("line_id", salesLineIds)
      .in("contact_phone", phoneVariants)
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .limit(1);
    if (convs && convs.length > 0) existing = convs[0];

    if (existing) {
      return apiSuccess({ conversation_id: existing.id, line_id: existing.line_id, created: false });
    }

    // Não existe: cria na linha escolhida (se for de vendas) ou na primeira.
    const targetLine =
      (parsed.data.line_id && lines.find((l: any) => l.id === parsed.data.line_id)) || lines[0];
    const contactPhone = contact.phone_e164?.startsWith("+")
      ? contact.phone_e164
      : `+${(contact.phone_e164 || canonical || "").replace(/^\+/, "")}`;
    const conv = await findOrCreateConversation({
      companyId: user.company_id,
      lineId: targetLine.id,
      contactPhone,
      contactName: contact.display_name ?? null,
    });
    return apiSuccess({ conversation_id: conv.id, line_id: targetLine.id, created: true });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    if (error instanceof Error && error.message === "Forbidden") return apiForbidden();
    return apiServerError(error);
  }
}
