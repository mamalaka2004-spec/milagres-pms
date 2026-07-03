/* eslint-disable @typescript-eslint/no-explicit-any */
// ===========================================================================
// Agentes de IA — query layer (Fase 3, migration 025)
// Tabelas ai_agents / ai_agent_bindings (fora dos tipos gerados → `as any`).
// ===========================================================================
import { createAdminClient } from "@/lib/supabase/admin";
import type { AiAgent, AiAgentBinding, AiBindingView } from "@/types/ai-agent";
import type { AgentCreate, AgentUpdate } from "@/lib/validations/ai-agent";

function db() {
  return createAdminClient();
}

// ─── Agentes ────────────────────────────────────────────────────────────────
export async function listAgents(companyId: string): Promise<AiAgent[]> {
  const { data, error } = await (db().from("ai_agents") as any)
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data as AiAgent[]) || [];
}

export async function getAgent(id: string, companyId: string): Promise<AiAgent | null> {
  const { data } = await (db().from("ai_agents") as any)
    .select("*")
    .eq("id", id)
    .eq("company_id", companyId)
    .maybeSingle();
  return (data as AiAgent | null) ?? null;
}

export async function createAgent(
  companyId: string,
  input: AgentCreate,
  createdBy: string | null
): Promise<AiAgent> {
  const { data, error } = await (db().from("ai_agents") as any)
    .insert({ ...input, company_id: companyId, created_by: createdBy })
    .select()
    .single();
  if (error) throw error;
  return data as AiAgent;
}

export async function updateAgent(
  id: string,
  companyId: string,
  input: AgentUpdate
): Promise<AiAgent> {
  const { data, error } = await (db().from("ai_agents") as any)
    .update(input)
    .eq("id", id)
    .eq("company_id", companyId)
    .select()
    .single();
  if (error) throw error;
  return data as AiAgent;
}

export async function deleteAgent(id: string, companyId: string): Promise<void> {
  const { error } = await (db().from("ai_agents") as any)
    .delete()
    .eq("id", id)
    .eq("company_id", companyId);
  if (error) throw error;
}

// ─── Bindings ─────────────────────────────────────────────────────────────
export async function listBindings(companyId: string): Promise<AiBindingView[]> {
  const { data, error } = await (db().from("ai_agent_bindings") as any)
    .select("*, whatsapp_lines(label, purpose), ai_agents(name)")
    .eq("company_id", companyId);
  if (error) throw error;
  return ((data as any[]) || []).map((r) => ({
    id: r.id,
    company_id: r.company_id,
    agent_id: r.agent_id,
    scope: r.scope,
    line_id: r.line_id,
    feature: r.feature,
    created_at: r.created_at,
    updated_at: r.updated_at,
    line_label: r.whatsapp_lines?.label ?? null,
    line_purpose: r.whatsapp_lines?.purpose ?? null,
    agent_name: r.ai_agents?.name ?? null,
  }));
}

/**
 * Vincula um agente a uma linha OU a uma feature (upsert manual: 1 agente por
 * linha / 1 por feature). Valida que o agente e a linha pertencem à empresa.
 */
export async function setBinding(
  companyId: string,
  input: { agent_id: string; line_id?: string | null; feature?: string | null }
): Promise<AiAgentBinding> {
  const line_id = input.line_id ?? null;
  const feature = line_id ? null : input.feature ?? null;
  const scope = line_id ? "whatsapp_line" : "feature";

  // Guard: agente é da empresa.
  const agent = await getAgent(input.agent_id, companyId);
  if (!agent) throw new Error("Agente não encontrado nesta empresa");

  // Guard: a linha é da empresa.
  if (line_id) {
    const { data: line } = await (db().from("whatsapp_lines") as any)
      .select("id")
      .eq("id", line_id)
      .eq("company_id", companyId)
      .maybeSingle();
    if (!line) throw new Error("Linha não encontrada nesta empresa");
  }

  // Existe binding para este alvo? (índice único parcial em company+line / company+feature)
  let existingQ = (db().from("ai_agent_bindings") as any)
    .select("id")
    .eq("company_id", companyId);
  existingQ = line_id ? existingQ.eq("line_id", line_id) : existingQ.eq("feature", feature);
  const { data: existing } = await existingQ.maybeSingle();

  if (existing?.id) {
    const { data, error } = await (db().from("ai_agent_bindings") as any)
      .update({ agent_id: input.agent_id })
      .eq("id", existing.id)
      .select()
      .single();
    if (error) throw error;
    return data as AiAgentBinding;
  }

  const { data, error } = await (db().from("ai_agent_bindings") as any)
    .insert({ company_id: companyId, agent_id: input.agent_id, scope, line_id, feature })
    .select()
    .single();
  if (error) throw error;
  return data as AiAgentBinding;
}

export async function deleteBinding(
  companyId: string,
  target: { line_id?: string | null; feature?: string | null }
): Promise<void> {
  // Defesa em profundidade: exige exatamente um alvo. Sem isso, um caller com ambos
  // apagaria só por line_id (ignorando feature); e sem nenhum apagaria tudo da empresa.
  const hasLine = !!target.line_id;
  const hasFeature = !!target.feature;
  if (hasLine === hasFeature) throw new Error("Informe line_id OU feature (exatamente um)");
  let q = (db().from("ai_agent_bindings") as any).delete().eq("company_id", companyId);
  q = hasLine ? q.eq("line_id", target.line_id) : q.eq("feature", target.feature);
  const { error } = await q;
  if (error) throw error;
}

// ─── Resolução em runtime (usado pela rota de auto-resposta + endpoint n8n) ──
export async function resolveAgentForLine(
  companyId: string,
  lineId: string
): Promise<AiAgent | null> {
  const { data: binding } = await (db().from("ai_agent_bindings") as any)
    .select("agent_id")
    .eq("company_id", companyId)
    .eq("line_id", lineId)
    .maybeSingle();
  if (!binding?.agent_id) return null;
  const agent = await getAgent(binding.agent_id, companyId);
  return agent && agent.active ? agent : null;
}

export async function resolveAgentForFeature(
  companyId: string,
  feature: string
): Promise<AiAgent | null> {
  const { data: binding } = await (db().from("ai_agent_bindings") as any)
    .select("agent_id")
    .eq("company_id", companyId)
    .eq("feature", feature)
    .maybeSingle();
  if (!binding?.agent_id) return null;
  const agent = await getAgent(binding.agent_id, companyId);
  return agent && agent.active ? agent : null;
}
