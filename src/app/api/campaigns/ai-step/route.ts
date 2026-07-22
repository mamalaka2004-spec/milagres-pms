/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOpenAI, DEFAULT_MODEL } from "@/lib/ai/client";
import { resolveAgentForLine } from "@/lib/db/queries/ai-agents";
import { assembleSystemPrompt } from "@/lib/ai/agent-runtime";
import { debitAiCredits } from "@/lib/ai/credits";
import { listMessages } from "@/lib/db/queries/whatsapp";
import { substituteVars } from "@/lib/campaigns/template";
import { apiSuccess, apiError, apiServerError } from "@/lib/api/response";

/**
 * Passo de cadência gerado por IA — chamado pelo worker campaign-tick
 * (header x-worker-secret = campaign_engine_config.worker_secret, ou env
 * CAMPAIGN_WORKER_SECRET com precedência, espelhando o worker).
 *
 * Monta: persona do agente da linha (Sarah) + instrução do passo (ai_prompt,
 * com {{vars}}) + histórico da conversa → devolve UMA mensagem curta de
 * follow-up. Sem tools — follow-up é texto, não consulta.
 */
const bodySchema = z.object({
  campaign_id: z.string().uuid(),
  recipient_id: z.string().uuid(),
  step_id: z.string().uuid(),
});

const HISTORY_LIMIT = 12;

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

export async function POST(request: NextRequest) {
  try {
    const db = createAdminClient();
    const { data: cfg } = await (db.from("campaign_engine_config") as any)
      .select("worker_secret")
      .limit(1)
      .maybeSingle();
    const expected = process.env.CAMPAIGN_WORKER_SECRET || cfg?.worker_secret;
    if (!expected) return apiError("Worker secret not configured", 503);
    const provided = request.headers.get("x-worker-secret") || "";
    if (!safeEqual(provided, expected)) return apiError("Forbidden", 403);

    const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) return apiError("Payload inválido", 400, parsed.error.flatten());
    const { campaign_id, recipient_id, step_id } = parsed.data;

    const [{ data: campaign }, { data: recipient }, { data: step }] = await Promise.all([
      (db.from("campaigns") as any).select("id, company_id, line_id, name").eq("id", campaign_id).maybeSingle(),
      (db.from("campaign_recipients") as any).select("*").eq("id", recipient_id).maybeSingle(),
      (db.from("campaign_steps") as any).select("*").eq("id", step_id).maybeSingle(),
    ]);
    if (!campaign || !recipient || !step) return apiError("Campanha/destinatário/passo não encontrado", 404);
    if (step.kind !== "ai" || !step.ai_prompt) return apiError("Passo não é do tipo IA", 400);

    const { data: company } = await (db.from("companies") as any)
      .select("name")
      .eq("id", campaign.company_id)
      .maybeSingle();

    // Persona: agente vinculado à linha (Sarah). Sem agente → persona mínima.
    const agent = campaign.line_id
      ? await resolveAgentForLine(campaign.company_id, campaign.line_id)
      : null;
    const persona = agent
      ? assembleSystemPrompt(agent, {
          companyName: company?.name || "Milagres Hospedagens",
          todayISO: new Date().toISOString().slice(0, 10),
          contactName: recipient.name ?? null,
        })
      : `Você é consultora de vendas da ${company?.name || "Milagres Hospedagens"}, atendendo por WhatsApp em português do Brasil.`;

    const vars = (recipient.variables ?? {}) as Record<string, string>;
    const instruction = substituteVars(step.ai_prompt, vars);

    // Histórico da conversa (quando existe) — follow-up com contexto real.
    const history: { role: "user" | "assistant"; content: string }[] = [];
    if (recipient.conversation_id) {
      const msgs = await listMessages(recipient.conversation_id, HISTORY_LIMIT);
      for (const m of msgs) {
        if (!m.text) continue;
        history.push({ role: m.direction === "inbound" ? "user" : "assistant", content: m.text });
      }
    }

    const system = [
      persona,
      "--- Tarefa: follow-up de campanha ---",
      "O contato NÃO respondeu à(s) mensagem(ns) anterior(es). Escreva a PRÓXIMA mensagem de follow-up seguindo a instrução abaixo.",
      `Instrução do passo: ${instruction}`,
      "Regras de saída: responda APENAS com o texto da mensagem (sem aspas, sem preâmbulo, sem assinatura). Máximo ~3 frases, tom natural de WhatsApp, sem pressão, sem repetir literalmente a mensagem anterior.",
    ].join("\n\n");

    const openai = getOpenAI();
    const completion = await openai.chat.completions.create({
      model: agent?.model || DEFAULT_MODEL,
      temperature: agent?.temperature ?? 0.7,
      max_tokens: 220,
      messages: [{ role: "system" as const, content: system }, ...history],
    });
    const text = completion.choices[0]?.message?.content?.trim() || null;
    if (!text) return apiError("IA não gerou texto", 502);

    await debitAiCredits({
      companyId: campaign.company_id,
      tokens: completion.usage?.total_tokens ?? 0,
      source: "campaign_ai_step",
      referenceType: "campaign",
      referenceId: campaign.id,
      description: `Follow-up IA — ${campaign.name}`,
    });

    return apiSuccess({ text });
  } catch (error) {
    return apiServerError(error);
  }
}
