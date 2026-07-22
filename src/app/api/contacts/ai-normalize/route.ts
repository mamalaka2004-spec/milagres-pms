/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOpenAI, DEFAULT_MODEL } from "@/lib/ai/client";
import { debitAiCredits } from "@/lib/ai/credits";
import { cleanName, splitName, nameNeedsReview } from "@/lib/contacts/name";
import { apiSuccess, apiError, apiUnauthorized, apiForbidden, apiServerError } from "@/lib/api/response";

/**
 * Sugere nomes limpos para o fonebook — NÃO grava nada. A UI mostra
 * antes/depois e a pessoa aplica o que aprovar (via /api/contacts/bulk).
 *
 * Estratégia em dois níveis para não gastar token à toa:
 *  1. Heurística local resolve o trivial ("@joao.silva" → João Silva).
 *  2. A IA entra só no que sobra ambíguo ("MARIA IG 🌸", "Cliente 3",
 *     "Zé do Cotinguiba"), decidindo o que é nome de pessoa, o que é
 *     apelido/nome social e o que não é nome nenhum.
 */
const bodySchema = z.object({
  contact_ids: z.array(z.string().uuid()).min(1).max(120).optional(),
  /** Sem ids: pega os pendentes de revisão (fila). */
  limit: z.number().int().min(1).max(120).optional(),
  only_dirty: z.boolean().optional(),
});

interface Suggestion {
  id: string;
  current_name: string | null;
  phone: string | null;
  first_name: string | null;
  last_name: string | null;
  social_name: string | null;
  display_name: string | null;
  /** "heuristic" = limpeza local; "ai" = decidido pelo modelo. */
  source: "heuristic" | "ai";
  /** Sem nome utilizável — a UI mostra como "sem nome" para revisão manual. */
  unusable: boolean;
  note?: string | null;
}

const SYSTEM = `Você organiza uma agenda de contatos brasileira de uma imobiliária/hospedagem.
Cada item tem um nome bagunçado (veio de exportação do Instagram, agenda do celular, planilhas).

Para cada contato devolva:
- first_name: primeiro nome REAL da pessoa, capitalizado (ex.: "João"). null se não der para saber.
- last_name: sobrenome, capitalizado. null se não houver.
- social_name: como a pessoa é conhecida/prefere ser chamada, quando o nome real vier acompanhado de apelido (ex.: "Zé", "Bia"). null se não houver apelido claro.
- display_name: rótulo completo para a agenda (nome + sobrenome, ou o apelido quando é só isso que existe). null se não houver nome nenhum.
- unusable: true quando NÃO existe nome de pessoa (ex.: "Cliente 3", "Contato 47", só números, só o nome de uma empresa/portal).
- note: observação curta só quando algo for ambíguo. Caso contrário null.

Regras:
- Remova marcadores de origem ("IG", "Insta", "Instagram", "WhatsApp", "Lead", "Cliente", "Airbnb", "Booking", "OLX", "site", "anúncio") e emojis.
- Handles viram nome quando dá para ler: "@joao.silva" → João Silva; "mari_costa" → Mari Costa.
- NUNCA invente nome que não esteja no texto original. Na dúvida, unusable: true.
- Corrija apenas a caixa (MARIA → Maria, joão → João). Preserve grafia de nomes próprios.
- Empresas/estabelecimentos: mantenha o nome em display_name, first_name null e unusable false.
Responda SOMENTE com JSON: {"contacts":[{"id":"...","first_name":...,"last_name":...,"social_name":...,"display_name":...,"unusable":false,"note":null}]}`;

export async function POST(req: NextRequest) {
  try {
    const user = await requireRole(["admin", "manager"]);
    const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return apiError("Dados inválidos", 400, parsed.error.flatten());

    const db = createAdminClient();
    let query = (db.from("whatsapp_contacts") as any)
      .select("id, display_name, phone_e164, first_name, last_name, social_name")
      .eq("company_id", user.company_id);
    if (parsed.data.contact_ids?.length) {
      query = query.in("id", parsed.data.contact_ids);
    } else {
      query = query.is("name_reviewed_at", null).limit(parsed.data.limit ?? 40);
    }
    const { data, error } = await query;
    if (error) throw error;
    const contacts = (data as any[]) || [];
    if (contacts.length === 0) return apiSuccess({ suggestions: [], ai_used: 0 });

    const suggestions: Suggestion[] = [];
    const forAi: { id: string; name: string }[] = [];

    for (const c of contacts) {
      const raw = (c.display_name ?? "").trim();
      // Já revisado manualmente e com nome limpo? Não mexe.
      if (!nameNeedsReview(raw)) {
        const parts = splitName(raw);
        suggestions.push({
          id: c.id,
          current_name: raw || null,
          phone: c.phone_e164 ?? null,
          ...parts,
          social_name: c.social_name ?? null,
          source: "heuristic",
          unusable: false,
          note: null,
        });
        continue;
      }
      // Casos "sujos" mas triviais: a heurística resolve sem gastar token.
      const cleaned = cleanName(raw);
      const trivial = cleaned && !/\d/.test(raw) && raw.replace(/[@._]/g, " ").trim().length > 2;
      if (trivial) {
        suggestions.push({
          id: c.id,
          current_name: raw || null,
          phone: c.phone_e164 ?? null,
          ...splitName(cleaned),
          social_name: c.social_name ?? null,
          source: "heuristic",
          unusable: false,
          note: null,
        });
        continue;
      }
      forAi.push({ id: c.id, name: raw || "(sem nome)" });
    }

    // ── Casos ambíguos → IA (um lote só) ──
    let aiTokens = 0;
    if (forAi.length > 0) {
      const openai = getOpenAI();
      const completion = await openai.chat.completions.create({
        model: DEFAULT_MODEL,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: JSON.stringify({ contacts: forAi }) },
        ],
      });
      aiTokens = completion.usage?.total_tokens ?? 0;
      const raw = completion.choices[0]?.message?.content ?? "{}";
      let parsedAi: { contacts?: any[] } = {};
      try {
        parsedAi = JSON.parse(raw);
      } catch {
        parsedAi = {};
      }
      const byId = new Map((parsedAi.contacts ?? []).map((r: any) => [String(r.id), r]));
      for (const item of forAi) {
        const r = byId.get(item.id);
        const original = contacts.find((c) => c.id === item.id);
        suggestions.push({
          id: item.id,
          current_name: original?.display_name ?? null,
          phone: original?.phone_e164 ?? null,
          first_name: r?.first_name ?? null,
          last_name: r?.last_name ?? null,
          social_name: r?.social_name ?? null,
          display_name:
            r?.display_name ??
            [r?.first_name, r?.last_name].filter(Boolean).join(" ") ??
            null,
          source: "ai",
          unusable: r?.unusable === true || (!r?.first_name && !r?.display_name),
          note: r?.note ?? null,
        });
      }
      await debitAiCredits({
        companyId: user.company_id,
        tokens: aiTokens,
        source: "contacts_ai_normalize",
        referenceType: "whatsapp_contact",
        description: `Organização de nomes — ${forAi.length} contato(s)`,
      });
    }

    return apiSuccess({
      suggestions,
      analyzed: contacts.length,
      ai_used: forAi.length,
      tokens: aiTokens,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    if (error instanceof Error && error.message === "Forbidden") return apiForbidden();
    return apiServerError(error);
  }
}
