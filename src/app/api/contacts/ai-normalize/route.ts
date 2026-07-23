/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOpenAI, DEFAULT_MODEL } from "@/lib/ai/client";
import { debitAiCredits } from "@/lib/ai/credits";
import {
  cleanName,
  splitName,
  nameNeedsReview,
  parseHandle,
  looksLikeBusiness,
  extractUnitCode,
  extractMarkers,
} from "@/lib/contacts/name";
import { apiSuccess, apiError, apiUnauthorized, apiForbidden, apiServerError } from "@/lib/api/response";

/**
 * Sugere a organização do fonebook — NÃO grava nada. A UI mostra antes/depois
 * e a pessoa aplica o que aprovar (via /api/contacts/bulk).
 *
 * Os padrões abaixo saíram da análise da base real (3.854 contatos):
 *   "@amamaedavalen_ Renata"      → handle + nome real DEPOIS
 *   "@albertocardosofisio"        → só handle, nome precisa ser deduzido
 *   "Beth Campos Cliente"         → nome + marcador de relacionamento (vira tag)
 *   "Ana Beatriz 206"             → nome + código da unidade (vira unit_hint)
 *   "Booking 01" / "@amoluastore" → não é pessoa, é portal/negócio
 *
 * Três níveis para não gastar token à toa:
 *   1. extração segura (handle + nome depois, marcadores, unidade) → alta
 *   2. limpeza determinística de caixa/ruído                       → alta
 *   3. IA só no que sobra ambíguo (deduzir nome a partir do handle) → media
 */
const bodySchema = z.object({
  contact_ids: z.array(z.string().uuid()).min(1).max(300).optional(),
  limit: z.number().int().min(1).max(300).optional(),
});

type Confidence = "alta" | "media" | "baixa";

interface Suggestion {
  id: string;
  current_name: string | null;
  phone: string | null;
  first_name: string | null;
  last_name: string | null;
  social_name: string | null;
  display_name: string | null;
  instagram_handle: string | null;
  unit_hint: string | null;
  suggested_tags: string[];
  is_company: boolean;
  confidence: Confidence;
  source: "heuristic" | "ai";
  /** Sem nome de pessoa aproveitável. */
  unusable: boolean;
  note?: string | null;
}

const SYSTEM = `Você organiza a agenda de contatos de uma imobiliária/hospedagem brasileira (São Miguel dos Milagres, AL).
Recebe contatos cujo nome veio bagunçado do Instagram, da agenda do celular e de planilhas.

Para CADA item devolva:
- first_name: primeiro nome real da pessoa, capitalizado e acentuado corretamente ("João", "Jéssica", "Thaís"). null se não der para saber.
- last_name: sobrenome capitalizado. null se não houver.
- social_name: apelido/como é conhecida, quando houver além do nome real. Senão null.
- display_name: rótulo final da agenda (nome + sobrenome). null se não houver nome.
- is_company: true quando é loja, ateliê, blog, agência, portal (Booking/Airbnb), perfil de divulgação ou marca — NÃO uma pessoa.
- unusable: true quando não há nome de pessoa nem nome de marca aproveitável (ex.: "Contato 47", só números, "*_*").
- note: observação curta só se algo for ambíguo; senão null.

Como deduzir nome a partir de um handle do Instagram:
- Separe as palavras coladas: "jennifersena" → Jennifer Sena; "albertocardosofisio" → Alberto Cardoso ("fisio" é profissão, descarte).
- Ignore prefixos/sufixos comuns: eu, ola, sou, oficial, ofc, real, blog, insta, dicas, makeup, pmu, fotografia, store, atelie, numerais no fim ("gabymendes_21" → Gaby Mendes).
- Handle invertido é comum: "agostinhonayara" → first_name "Nayara", last_name "Agostinho".
- Apelidos são nomes válidos: Bia, Gabi, Duda, Leh, Naty, Zé, Jô.
- NUNCA invente nome que não esteja no texto. Se o handle não permitir ler um nome com segurança, use unusable ou is_company.

Regras gerais:
- Corrija apenas caixa e acentuação; preserve a grafia do nome próprio.
- Nomes de pessoa em MAIÚSCULAS ou minúsculas viram capitalizados.
Responda SOMENTE JSON: {"contacts":[{"id":"...","first_name":...,"last_name":...,"social_name":...,"display_name":...,"is_company":false,"unusable":false,"note":null}]}`;

/** Limpeza segura, sem IA. Retorna null quando o caso é ambíguo demais. */
function heuristicSuggestion(c: any): Suggestion | null {
  const raw = (c.display_name ?? "").trim();
  const { handle, rest } = parseHandle(raw);
  const unit = extractUnitCode(raw) ?? c.unit_hint ?? null;
  const markers = extractMarkers(raw);
  const base: Omit<Suggestion, "first_name" | "last_name" | "display_name" | "confidence" | "unusable" | "is_company"> = {
    id: c.id,
    current_name: raw || null,
    phone: c.phone_e164 ?? null,
    social_name: c.social_name ?? null,
    instagram_handle: handle ?? c.instagram_handle ?? null,
    unit_hint: unit,
    suggested_tags: markers,
    source: "heuristic",
    note: null,
  };

  // 1) Nome REAL depois do handle / ao lado de marcadores: extração segura.
  const cleanedRest = cleanName(rest);
  if (cleanedRest && cleanedRest.length >= 2) {
    const parts = splitName(cleanedRest);
    return { ...base, ...parts, is_company: false, confidence: "alta", unusable: false };
  }

  // 2) Sem handle e nome já legível: só normaliza caixa.
  if (!handle && !nameNeedsReview(raw)) {
    const parts = splitName(raw);
    return { ...base, ...parts, is_company: false, confidence: "alta", unusable: false };
  }

  // 3) Handle que aparenta negócio: não é pessoa, e disso temos certeza.
  if (handle && looksLikeBusiness(handle) && !cleanedRest) {
    return {
      ...base,
      first_name: null,
      last_name: null,
      display_name: raw || (handle ? `@${handle}` : null),
      is_company: true,
      confidence: "alta",
      unusable: false,
      note: "perfil de negócio — não recebe saudação com nome",
    };
  }

  return null; // ambíguo → IA decide
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireRole(["admin", "manager"]);
    const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return apiError("Dados inválidos", 400, parsed.error.flatten());

    const db = createAdminClient();
    let query = (db.from("whatsapp_contacts") as any)
      .select("id, display_name, phone_e164, first_name, last_name, social_name, instagram_handle, unit_hint")
      .eq("company_id", user.company_id);
    if (parsed.data.contact_ids?.length) {
      query = query.in("id", parsed.data.contact_ids);
    } else {
      query = query.is("name_reviewed_at", null).limit(parsed.data.limit ?? 60);
    }
    const { data, error } = await query;
    if (error) throw error;
    const contacts = (data as any[]) || [];
    if (contacts.length === 0) return apiSuccess({ suggestions: [], analyzed: 0, ai_used: 0 });

    const suggestions: Suggestion[] = [];
    const forAi: { id: string; texto: string; handle: string | null }[] = [];

    for (const c of contacts) {
      const h = heuristicSuggestion(c);
      if (h) suggestions.push(h);
      else {
        const { handle } = parseHandle(c.display_name);
        forAi.push({
          id: c.id,
          texto: (c.display_name ?? "").trim() || "(sem nome)",
          handle: handle ?? c.instagram_handle ?? null,
        });
      }
    }

    // ── Ambíguos → IA (em lotes de 60 para caber no contexto com folga) ──
    let aiTokens = 0;
    if (forAi.length > 0) {
      const openai = getOpenAI();
      for (let i = 0; i < forAi.length; i += 60) {
        const chunk = forAi.slice(i, i + 60);
        const completion = await openai.chat.completions.create({
          model: DEFAULT_MODEL,
          temperature: 0,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: SYSTEM },
            { role: "user", content: JSON.stringify({ contacts: chunk }) },
          ],
        });
        aiTokens += completion.usage?.total_tokens ?? 0;
        let parsedAi: { contacts?: any[] } = {};
        try {
          parsedAi = JSON.parse(completion.choices[0]?.message?.content ?? "{}");
        } catch {
          parsedAi = {};
        }
        const byId = new Map((parsedAi.contacts ?? []).map((r: any) => [String(r.id), r]));
        for (const item of chunk) {
          const r = byId.get(item.id);
          const original = contacts.find((c) => c.id === item.id);
          const display =
            r?.display_name ?? [r?.first_name, r?.last_name].filter(Boolean).join(" ") ?? null;
          suggestions.push({
            id: item.id,
            current_name: original?.display_name ?? null,
            phone: original?.phone_e164 ?? null,
            first_name: r?.first_name ?? null,
            last_name: r?.last_name ?? null,
            social_name: r?.social_name ?? original?.social_name ?? null,
            display_name: display || null,
            instagram_handle: item.handle,
            unit_hint: extractUnitCode(original?.display_name) ?? original?.unit_hint ?? null,
            suggested_tags: extractMarkers(original?.display_name),
            is_company: r?.is_company === true,
            // Nome deduzido de handle nunca é certeza — sempre passa por revisão.
            confidence: "media",
            source: "ai",
            unusable: r?.unusable === true || (!r?.first_name && !display && r?.is_company !== true),
            note: r?.note ?? null,
          });
        }
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
