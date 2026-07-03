import { NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveAgentForLine } from "@/lib/db/queries/ai-agents";
import { assembleSystemPrompt, leadFacingTools } from "@/lib/ai/agent-runtime";
import { describeBusinessHours } from "@/lib/whatsapp/ai-prompt";
import { apiSuccess, apiError, apiServerError } from "@/lib/api/response";
import type { WaBusinessHours } from "@/types/ai-agent";

/**
 * Fonte única de config de agente lida pelo n8n (ex.: workflow "Sarah" de Vendas).
 * Protegido pelo mesmo segredo do webhook. Recebe ?line_id= e devolve a config
 * completa do agente vinculado à linha + o system prompt já montado.
 *   GET /api/ai/agents/resolve?line_id=<uuid>
 *   Header: x-webhook-secret: <WHATSAPP_WEBHOOK_SECRET>
 */
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

export async function GET(request: NextRequest) {
  try {
    const expected = process.env.WHATSAPP_WEBHOOK_SECRET;
    if (!expected) return apiError("Webhook not configured", 503);
    const provided = request.headers.get("x-webhook-secret") || "";
    if (!safeEqual(provided, expected)) return apiError("Forbidden", 403);

    const lineId = request.nextUrl.searchParams.get("line_id");
    if (!lineId) return apiError("line_id é obrigatório", 400);

    const supabase = createAdminClient();
    const { data: line } = await supabase
      .from("whatsapp_lines")
      .select("id, company_id, label, purpose, business_hours, ai_enabled")
      .eq("id", lineId)
      .maybeSingle();
    if (!line) return apiError("Linha não encontrada", 404);

    const { data: company } = await supabase
      .from("companies")
      .select("name, ai_enabled")
      .eq("id", (line as { company_id: string }).company_id)
      .maybeSingle();

    const lineRow = line as { company_id: string; label: string; purpose: string; business_hours: unknown; ai_enabled: boolean };
    const companyRow = company as { name?: string; ai_enabled?: boolean } | null;

    const agent = await resolveAgentForLine(lineRow.company_id, lineId);
    if (!agent) {
      return apiSuccess({
        resolved: false,
        reason: "Nenhum agente ativo vinculado a esta linha.",
        ai_enabled: companyRow?.ai_enabled === true && lineRow.ai_enabled === true,
      });
    }

    const businessHoursLine = describeBusinessHours(
      (agent.business_hours || (lineRow.business_hours as WaBusinessHours | null)) as never
    );
    const systemPrompt = assembleSystemPrompt(agent, {
      companyName: companyRow?.name || "Milagres Hospedagens",
      todayISO: new Date().toISOString().slice(0, 10),
      businessHoursLine,
    });

    return apiSuccess({
      resolved: true,
      ai_enabled: companyRow?.ai_enabled === true && lineRow.ai_enabled === true,
      line: { id: lineId, label: lineRow.label, purpose: lineRow.purpose },
      agent: {
        id: agent.id,
        name: agent.name,
        provider: agent.provider,
        model: agent.model,
        temperature: agent.temperature,
        max_tokens: agent.max_tokens,
        top_p: agent.top_p,
        execution: agent.execution,
        n8n_url: agent.n8n_url,
        fallback_human: agent.fallback_human,
        handoff_keywords: agent.handoff_keywords,
        history_limit: agent.history_limit,
        max_tool_loops: agent.max_tool_loops,
        // `tools` = seleção crua do agente. `effective_tools` = subconjunto lead-safe.
        // TODAS as linhas WhatsApp (booking E sales/corretagem) falam com pessoas de fora
        // (hóspedes / compradores), então o clamp lead-safe vale p/ as duas — ferramentas
        // internas (financeiro, tarefas) nunca vão pra um canal externo. O n8n usa
        // `effective_tools` no diálogo com o lead; se rodar passos internos, usa `tools`.
        tools: agent.tools,
        effective_tools: leadFacingTools(agent),
        knowledge_source: agent.knowledge_source,
      },
      system_prompt: systemPrompt,
    });
  } catch (error) {
    return apiServerError(error);
  }
}

export const dynamic = "force-dynamic";
