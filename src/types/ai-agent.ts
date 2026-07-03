// ===========================================================================
// Agentes de IA — tipos + catálogos (Fase 3, migration 025)
// Tabelas ai_agents / ai_agent_bindings. Não estão nos tipos gerados do Supabase,
// então o query layer usa `(supabase.from(...) as any)` (mesmo padrão do funil).
// ===========================================================================

export type AiProvider = "openai" | "anthropic" | "google" | "custom";
export type AiExecution = "api_route" | "n8n";
export type AiKnowledgeSource = "tools" | "manual" | "none";
export type AiBindingScope = "whatsapp_line" | "feature";

export interface FaqEntry {
  q: string;
  a: string;
}

export type WaBusinessHours = Record<string, { open: string; close: string } | null>;

export interface AiAgent {
  id: string;
  company_id: string;
  name: string;
  description: string | null;
  active: boolean;
  system_prompt: string;
  provider: AiProvider;
  model: string;
  temperature: number;
  max_tokens: number | null;
  top_p: number;
  tools: string[];
  knowledge_source: AiKnowledgeSource;
  knowledge_urls: string[];
  faq: FaqEntry[];
  business_hours: WaBusinessHours | null;
  fallback_human: boolean;
  handoff_keywords: string[];
  execution: AiExecution;
  n8n_url: string | null;
  history_limit: number;
  max_tool_loops: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface AiAgentBinding {
  id: string;
  company_id: string;
  agent_id: string;
  scope: AiBindingScope;
  line_id: string | null;
  feature: string | null;
  created_at: string;
  updated_at: string;
}

/** Binding enriquecido com o rótulo da linha, para a UI. */
export interface AiBindingView extends AiAgentBinding {
  line_label?: string | null;
  line_purpose?: string | null;
  agent_name?: string | null;
}

// ─── Catálogo de ferramentas (espelha src/lib/ai/tools.ts) ─────────────────
// `leadSafe` = pode ser exposta a leads/hóspedes no WhatsApp. As não-safe são
// operacionais/gerenciais e a rota lead-facing faz clamp mesmo se selecionadas.
export interface ToolMeta {
  name: string;
  label: string;
  description: string;
  leadSafe: boolean;
}

export const TOOL_CATALOG: ToolMeta[] = [
  { name: "list_properties", label: "Listar imóveis", description: "Quais imóveis existem / comparar opções.", leadSafe: true },
  { name: "property_details", label: "Detalhes do imóvel", description: "Detalhes comerciais (preço, localização geral).", leadSafe: true },
  { name: "property_guide_info", label: "Guia público da unidade", description: "Descrição, comodidades, regras, horários, mídias.", leadSafe: true },
  { name: "search_knowledge", label: "Base de conhecimento", description: "FAQ do destino: como chegar, praias, restaurantes, etc.", leadSafe: true },
  { name: "check_availability", label: "Disponibilidade", description: "Disponibilidade de um imóvel num período.", leadSafe: true },
  { name: "find_my_reservation", label: "Minha reserva", description: "Reserva do próprio contato pelo telefone dele.", leadSafe: true },
  { name: "property_private_info", label: "Dados privados (pós-reserva)", description: "Wi-Fi / acesso / endereço — só com reserva confirmada.", leadSafe: true },
  { name: "today_summary", label: "Resumo do dia", description: "Panorama operacional de hoje. (interno)", leadSafe: false },
  { name: "search_reservations", label: "Buscar reservas", description: "Consultar reservas da empresa. (interno)", leadSafe: false },
  { name: "calendar_range", label: "Agenda por período", description: "Ocupação/agenda num intervalo. (interno)", leadSafe: false },
  { name: "tasks_today", label: "Tarefas de hoje", description: "Tarefas operacionais do dia. (interno)", leadSafe: false },
  { name: "finance_summary", label: "Resumo financeiro", description: "Receita, ocupação e breakdown. (interno)", leadSafe: false },
];

export const LEAD_SAFE_TOOLS: string[] = TOOL_CATALOG.filter((t) => t.leadSafe).map((t) => t.name);
export const ALL_TOOL_NAMES: string[] = TOOL_CATALOG.map((t) => t.name);

// ─── Modelos por provider (só OpenAI executa nesta fase; demais = futuro) ───
export const PROVIDER_MODELS: Record<AiProvider, { value: string; label: string }[]> = {
  openai: [
    { value: "gpt-4o-mini", label: "GPT-4o mini (rápido/barato)" },
    { value: "gpt-4o", label: "GPT-4o" },
    { value: "gpt-4.1-mini", label: "GPT-4.1 mini" },
    { value: "gpt-4.1", label: "GPT-4.1" },
  ],
  anthropic: [
    { value: "claude-haiku-4-5", label: "Claude Haiku 4.5" },
    { value: "claude-sonnet-5", label: "Claude Sonnet 5" },
  ],
  google: [
    { value: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
    { value: "gemini-2.5-pro", label: "Gemini 2.5 Pro" },
  ],
  custom: [{ value: "custom", label: "Modelo customizado" }],
};

/** Providers que a rota realmente executa hoje. Os demais são só config (futuro). */
export const EXECUTED_PROVIDERS: AiProvider[] = ["openai"];

export const BINDABLE_FEATURES: { value: string; label: string }[] = [
  { value: "internal_chat", label: "Assistente interno (chat do painel)" },
];
