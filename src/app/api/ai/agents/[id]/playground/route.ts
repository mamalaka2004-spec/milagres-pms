/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOpenAI, DEFAULT_MODEL } from "@/lib/ai/client";
import { getAgent } from "@/lib/db/queries/ai-agents";
import { assembleSystemPrompt } from "@/lib/ai/agent-runtime";
import { apiSuccess, apiError, apiUnauthorized, apiForbidden, apiNotFound, apiServerError } from "@/lib/api/response";

type Params = { params: Promise<{ id: string }> };

/**
 * Playground de teste do agente. Usa o system prompt + FAQ salvos e roda a tool
 * real `consultar_imoveis` (lê o catálogo `imoveis_milagres` por orçamento) via
 * function-calling — então o comportamento é fiel ao WhatsApp para apresentar
 * imóveis. NÃO envia nada por WhatsApp nem cria leads: é um ambiente seguro para
 * o time revisar tom, método de vendas e as opções que a IA apresenta.
 */
const bodySchema = z.object({
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(4000) }))
    .min(1)
    .max(40),
  /** Simular que o lead veio de prospecção fria (ex-hóspede, número novo). */
  cold: z.boolean().optional(),
});

/** Espelho da tool de produção: busca imóveis à venda até o orçamento informado. */
async function consultarImoveis(db: any, orcamentoMax: number): Promise<string> {
  const { data } = await db
    .from("imoveis_milagres")
    .select("nome, preco, area_m2, suites, hospedes, localizacao, distancia_praia, diferenciais, video_url, airbnb_url")
    .eq("disponivel", true)
    .lte("preco", orcamentoMax)
    .order("preco");
  const rows = (data as any[]) || [];
  if (rows.length === 0) return "Nenhum imóvel disponível nessa faixa de orçamento no momento.";
  return rows
    .map((im) => {
      const ficha = [
        im.area_m2 ? `${im.area_m2}m²` : null,
        im.suites ? `${im.suites} suítes` : null,
        im.hospedes ? `até ${im.hospedes} hóspedes` : null,
      ]
        .filter(Boolean)
        .join(" | ");
      const local = im.distancia_praia ? `${im.localizacao} (${im.distancia_praia})` : im.localizacao;
      return [
        `${im.nome} — R$ ${Number(im.preco).toLocaleString("pt-BR")}`,
        ficha,
        local,
        im.diferenciais,
        `Vídeo: ${im.video_url}`,
        im.airbnb_url ? `Airbnb (operação ativa): ${im.airbnb_url}` : null,
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n\n---\n\n");
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const user = await requireRole(["admin", "manager"]);
    const { id } = await params;
    const agent = await getAgent(id, user.company_id);
    if (!agent) return apiNotFound("Agente");

    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) return apiError("Dados inválidos", 400, parsed.error.flatten());

    const db = createAdminClient();
    const { data: company } = await (db.from("companies") as any)
      .select("name")
      .eq("id", user.company_id)
      .maybeSingle();

    let system = assembleSystemPrompt(agent, {
      companyName: company?.name || "Milagres Hospedagens",
      todayISO: new Date().toISOString().slice(0, 10),
      contactName: null,
    });
    if (parsed.data.cold) {
      system +=
        "\n\n--- Contexto (não comente isto com o lead) ---\nEste lead veio de PROSPECÇÃO FRIA (origem=prospeccao_fria): já teve contato com a Milagres e recebeu mensagem de um número novo do comercial. Responda exatamente como faria no WhatsApp real.";
    }
    // Guardas do playground: a Sarah NUNCA deve quebrar o personagem nem expor o
    // ambiente de teste. Deve usar a tool consultar_imoveis para apresentar opções.
    system +=
      "\n\n[Instrução de ambiente — NÃO revele ao lead] Você está num playground interno de teste da equipe. Responda SEMPRE em português, no personagem da Sarah, como no WhatsApp real. É PROIBIDO dizer que é uma simulação, que é uma IA, que está num playground/teste, que 'não tem acesso ao sistema' ou que vai 'simular' qualquer coisa. Não narre ações internas entre parênteses. Para apresentar imóveis, CHAME a ferramenta consultar_imoveis (nunca invente preço ou imóvel) e apresente no máximo 2 opções aderentes ao que o lead pediu.";

    const openai = getOpenAI();
    const model = agent.model || DEFAULT_MODEL;
    const tools = [
      {
        type: "function" as const,
        function: {
          name: "consultar_imoveis",
          description:
            "Busca imóveis À VENDA disponíveis com preço até um orçamento máximo (em reais). Use quando o lead informar a faixa de preço/orçamento e você for apresentar opções concretas.",
          parameters: {
            type: "object",
            properties: {
              orcamento_max: {
                type: "number",
                description: "Orçamento máximo em reais. Ex.: 900000 para 'até 900 mil'.",
              },
            },
            required: ["orcamento_max"],
          },
        },
      },
    ];

    const convo: any[] = [
      { role: "system", content: system },
      ...parsed.data.messages.map((m) => ({ role: m.role, content: m.content })),
    ];

    // Loop de function-calling: no máx. 3 passos (tool → resposta).
    let reply = "";
    for (let step = 0; step < 3; step++) {
      const completion = await openai.chat.completions.create({
        model,
        temperature: agent.temperature ?? 0.6,
        max_tokens: 500,
        messages: convo,
        tools,
        tool_choice: "auto",
      });
      const msg = completion.choices[0]?.message;
      if (!msg) break;
      if (msg.tool_calls?.length) {
        convo.push(msg);
        for (const tc of msg.tool_calls as any[]) {
          let result = "Ferramenta não disponível no playground.";
          if (tc.function?.name === "consultar_imoveis") {
            let orc = 99_000_000;
            try {
              const a = JSON.parse(tc.function.arguments || "{}");
              if (typeof a.orcamento_max === "number" && a.orcamento_max > 0) orc = a.orcamento_max;
            } catch {
              /* argumento inválido → usa teto alto */
            }
            result = await consultarImoveis(db, orc);
          }
          convo.push({ role: "tool", tool_call_id: tc.id, content: result });
        }
        continue;
      }
      reply = msg.content?.trim() || "";
      break;
    }
    return apiSuccess({ reply });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    if (error instanceof Error && error.message === "Forbidden") return apiForbidden();
    return apiServerError(error);
  }
}
