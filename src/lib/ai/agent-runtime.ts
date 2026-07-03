// ===========================================================================
// Runtime dos agentes de IA (Fase 3) — puro, sem I/O.
// Usado pela rota /api/whatsapp/ai-reply e pelo endpoint /api/ai/agents/resolve
// (fonte única lida pelo n8n). Monta o system prompt a partir da persona salva
// no agente + contexto dinâmico, e faz o clamp de ferramentas.
// ===========================================================================
import type { AiAgent } from "@/types/ai-agent";
import { LEAD_SAFE_TOOLS } from "@/types/ai-agent";

export interface PromptContext {
  companyName: string;
  todayISO: string;
  contactName?: string | null;
  businessHoursLine?: string | null;
}

/**
 * Monta o system prompt final: persona salva (agent.system_prompt) + bloco de
 * contexto dinâmico + FAQ/URLs quando o conhecimento é 'manual'.
 */
export function assembleSystemPrompt(agent: AiAgent, ctx: PromptContext): string {
  const parts: string[] = [];
  if (agent.system_prompt?.trim()) parts.push(agent.system_prompt.trim());

  const ctxLines: string[] = [`Empresa: ${ctx.companyName}.`, `Hoje é ${ctx.todayISO}.`];
  if (ctx.contactName) ctxLines.push(`Você está conversando com ${ctx.contactName}.`);
  if (ctx.businessHoursLine) ctxLines.push(`Atendimento humano: ${ctx.businessHoursLine}`);
  parts.push(`--- Contexto ---\n${ctxLines.join("\n")}`);

  if (agent.knowledge_source === "manual") {
    if (Array.isArray(agent.faq) && agent.faq.length > 0) {
      const faq = agent.faq
        .filter((f) => f && f.q && f.a)
        .map((f) => `P: ${f.q}\nR: ${f.a}`)
        .join("\n\n");
      if (faq) parts.push(`--- Perguntas frequentes (use como referência) ---\n${faq}`);
    }
    if (Array.isArray(agent.knowledge_urls) && agent.knowledge_urls.length > 0) {
      parts.push(`--- Referências ---\n${agent.knowledge_urls.join("\n")}`);
    }
  }

  return parts.join("\n\n");
}

/**
 * Ferramentas efetivas do agente para um canal lead-facing (WhatsApp de leads/
 * hóspedes): interseção das ferramentas escolhidas com o whitelist seguro.
 * Defesa em profundidade — mesmo que alguém selecione uma tool interna, ela não
 * vaza para o lead. Se o agente não escolheu nenhuma, usa todo o whitelist seguro.
 */
export function leadFacingTools(agent: AiAgent): string[] {
  const chosen = Array.isArray(agent.tools) ? agent.tools : [];
  if (chosen.length === 0) return [...LEAD_SAFE_TOOLS];
  return chosen.filter((t) => LEAD_SAFE_TOOLS.includes(t));
}
