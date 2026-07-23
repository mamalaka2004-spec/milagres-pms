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
 * Playground de teste do agente: simula a conversa usando o system prompt + FAQ
 * salvos, direto pela OpenAI. É uma SIMULAÇÃO de estilo/roteiro — não roda as
 * tools (consultar_imoveis, base de conhecimento) nem envia nada por WhatsApp.
 * Serve para o time revisar o tom e o método de vendas antes de ir ao ar.
 */
const bodySchema = z.object({
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(4000) }))
    .min(1)
    .max(40),
  /** Simular que o lead veio de prospecção fria (ex-hóspede, número novo). */
  cold: z.boolean().optional(),
});

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
        "\n\n--- Simulação ---\nEste lead veio de PROSPECÇÃO FRIA (origem=prospeccao_fria): já teve contato com a Milagres e recebeu mensagem de um número novo. Responda como responderia no WhatsApp real. (No playground as ferramentas de imóveis/KB não rodam — descreva com o que você sabe.)";
    }

    const openai = getOpenAI();
    const completion = await openai.chat.completions.create({
      model: agent.model || DEFAULT_MODEL,
      temperature: agent.temperature ?? 0.6,
      max_tokens: 400,
      messages: [
        { role: "system" as const, content: system },
        ...parsed.data.messages.map((m) => ({ role: m.role, content: m.content })),
      ],
    });
    const reply = completion.choices[0]?.message?.content?.trim() || "";
    return apiSuccess({ reply, tokens: completion.usage?.total_tokens ?? 0 });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    if (error instanceof Error && error.message === "Forbidden") return apiForbidden();
    return apiServerError(error);
  }
}
