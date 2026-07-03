"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Trash2, Loader2, Bot, Save, X, Sparkles } from "lucide-react";
import { Button, Input, Textarea, Select, ConfirmDialog, Badge } from "@/components/ui";
import { cn } from "@/lib/utils/cn";
import { api } from "@/lib/chat/utils";
import { toast } from "@/components/ui/use-toast";
import {
  TOOL_CATALOG,
  PROVIDER_MODELS,
  EXECUTED_PROVIDERS,
  type AiAgent,
  type AiBindingView,
  type AiProvider,
  type FaqEntry,
} from "@/types/ai-agent";

type LineLite = { id: string; label: string; phone: string; ai_enabled: boolean; is_active: boolean };
type Draft = Partial<AiAgent>;

const NEW_AGENT: Draft = {
  name: "Novo agente",
  description: "",
  active: false,
  system_prompt: "Você é um assistente virtual da hospedagem. Seja acolhedor, conciso e nunca invente informações.",
  provider: "openai",
  model: "gpt-4o-mini",
  temperature: 0.4,
  max_tokens: null,
  top_p: 1,
  tools: [],
  knowledge_source: "tools",
  knowledge_urls: [],
  faq: [],
  fallback_human: true,
  handoff_keywords: ["falar com humano", "atendente", "falar com atendente", "quero um humano", "pessoa real"],
  execution: "api_route",
  n8n_url: null,
  history_limit: 20,
  max_tool_loops: 3,
};

export function AiAgentsShell({ canEdit }: { canEdit: boolean }) {
  const [agents, setAgents] = useState<AiAgent[]>([]);
  const [bindings, setBindings] = useState<AiBindingView[]>([]);
  const [lines, setLines] = useState<LineLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);

  const load = useCallback(async () => {
    const [ags, binds, aiSettings] = await Promise.all([
      api<AiAgent[]>("/api/ai/agents"),
      api<AiBindingView[]>("/api/ai/agents/bindings"),
      api<{ lines: LineLite[] }>("/api/settings/ai"),
    ]);
    setAgents(ags);
    setBindings(binds);
    setLines(aiSettings.lines || []);
    return ags;
  }, []);

  useEffect(() => {
    setLoading(true);
    load()
      .then((ags) => {
        if (ags.length && !selectedId) {
          setSelectedId(ags[0].id);
          setDraft(ags[0]);
        }
      })
      .catch((e) => toast({ title: "Erro ao carregar", description: e instanceof Error ? e.message : "", variant: "error" }))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]);

  function selectAgent(a: AiAgent) {
    setSelectedId(a.id);
    setDraft({ ...a });
  }

  function startNew() {
    setSelectedId(null);
    setDraft({ ...NEW_AGENT });
  }

  const bindingForAgent = useCallback(
    (agentId: string) => bindings.filter((b) => b.agent_id === agentId),
    [bindings]
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-gray-400">
        <Loader2 className="animate-spin" size={20} />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Como funciona */}
      <div className="rounded-xl border border-brand-100 bg-brand-50/50 p-4 text-xs text-gray-600">
        <p className="font-medium text-gray-800">Como a execução funciona</p>
        <p className="mt-1">
          <span className="font-medium">Reservas</span> roda na própria plataforma (rota Next.js) — o agente vinculado
          define prompt, modelo, temperatura e ferramentas. <span className="font-medium">Vendas</span> é executada no
          n8n (Sarah): marque a execução como <span className="font-mono">n8n</span> e o workflow lê a mesma config
          por <span className="font-mono">GET /api/ai/agents/resolve</span>. A chave-mestra e a hierarquia de ativação
          (sistema → linha → conversa) continuam em <span className="font-medium">Ajustes → Inteligência Artificial</span>.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[280px_1fr]">
        {/* Lista de agentes + vínculos */}
        <div className="space-y-5">
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900">Agentes</h3>
              {canEdit && (
                <button type="button" onClick={startNew} className="rounded-lg bg-brand-500 p-1.5 text-white hover:bg-brand-600">
                  <Plus size={15} />
                </button>
              )}
            </div>
            <ul className="space-y-1">
              {agents.map((a) => {
                const binds = bindingForAgent(a.id);
                return (
                  <li key={a.id}>
                    <button
                      type="button"
                      onClick={() => selectAgent(a)}
                      className={cn(
                        "flex w-full items-start gap-2 rounded-lg px-2 py-2 text-left",
                        selectedId === a.id ? "bg-brand-50 ring-1 ring-brand-200" : "hover:bg-gray-50"
                      )}
                    >
                      <span className={cn("mt-1 h-2 w-2 shrink-0 rounded-full", a.active ? "bg-emerald-500" : "bg-gray-300")} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-gray-800">{a.name}</span>
                        <span className="mt-0.5 flex flex-wrap items-center gap-1">
                          <Badge tone="neutral" className="text-[10px]">{a.execution === "n8n" ? "n8n" : "plataforma"}</Badge>
                          <span className="text-[10px] text-gray-400">{a.model}</span>
                          {binds.map((b) => (
                            <span key={b.id} className="text-[10px] text-brand-600">· {b.line_label || b.feature}</span>
                          ))}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
              {agents.length === 0 && <li className="px-2 py-6 text-center text-xs text-gray-400">Nenhum agente ainda.</li>}
            </ul>
          </div>

          <BindingsCard lines={lines} agents={agents} bindings={bindings} canEdit={canEdit} onChanged={load} />
        </div>

        {/* Editor */}
        <div>
          {draft ? (
            <AgentEditor
              key={selectedId ?? "new"}
              draft={draft}
              setDraft={setDraft}
              isNew={!selectedId}
              canEdit={canEdit}
              onSaved={async (saved) => {
                const ags = await load();
                const found = ags.find((x) => x.id === saved.id) ?? null;
                setSelectedId(saved.id);
                setDraft(found);
              }}
              onDeleted={async () => {
                const ags = await load();
                setSelectedId(ags[0]?.id ?? null);
                setDraft(ags[0] ?? null);
              }}
            />
          ) : (
            <div className="rounded-xl border border-gray-200 bg-white p-10 text-center text-sm text-gray-400">
              Selecione um agente à esquerda ou crie um novo.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Editor ──────────────────────────────────────────────────────────────
function AgentEditor({
  draft,
  setDraft,
  isNew,
  canEdit,
  onSaved,
  onDeleted,
}: {
  draft: Draft;
  setDraft: (d: Draft) => void;
  isNew: boolean;
  canEdit: boolean;
  onSaved: (saved: AiAgent) => Promise<void>;
  onDeleted: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const set = <K extends keyof AiAgent>(k: K, v: AiAgent[K]) => setDraft({ ...draft, [k]: v });

  const provider = (draft.provider || "openai") as AiProvider;
  const models = PROVIDER_MODELS[provider] || PROVIDER_MODELS.openai;
  const providerExecuted = EXECUTED_PROVIDERS.includes(provider);

  const toggleTool = (name: string) => {
    const cur = new Set(draft.tools || []);
    if (cur.has(name)) cur.delete(name);
    else cur.add(name);
    set("tools", Array.from(cur));
  };

  async function save() {
    if (!canEdit || busy) return;
    if (!draft.name || draft.name.trim().length < 2) {
      toast({ title: "Nome muito curto", variant: "error" });
      return;
    }
    setBusy(true);
    try {
      const payload = { ...draft };
      delete (payload as Record<string, unknown>).id;
      delete (payload as Record<string, unknown>).company_id;
      delete (payload as Record<string, unknown>).created_at;
      delete (payload as Record<string, unknown>).updated_at;
      delete (payload as Record<string, unknown>).created_by;
      const saved = isNew
        ? await api<AiAgent>("/api/ai/agents", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
        : await api<AiAgent>(`/api/ai/agents/${draft.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      toast({ title: "Agente salvo", variant: "success" });
      await onSaved(saved);
    } catch (e) {
      toast({ title: "Erro ao salvar", description: e instanceof Error ? e.message : "", variant: "error" });
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!draft.id) return;
    try {
      await api(`/api/ai/agents/${draft.id}`, { method: "DELETE" });
      toast({ title: "Agente removido", variant: "success" });
      await onDeleted();
    } catch (e) {
      toast({ title: "Não foi possível remover", description: e instanceof Error ? e.message : "", variant: "error" });
    }
  }

  const disabled = !canEdit;

  return (
    <div className="space-y-5 rounded-xl border border-gray-200 bg-white p-5">
      {/* Cabeçalho */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-500/10">
          <Bot className="text-brand-600" size={18} />
        </div>
        <input
          value={draft.name || ""}
          disabled={disabled}
          onChange={(e) => set("name", e.target.value)}
          className="min-w-0 flex-1 rounded-lg border border-transparent px-2 py-1.5 text-lg font-semibold text-gray-900 hover:border-gray-200 focus:border-gray-300 focus-visible:outline-none disabled:bg-transparent"
        />
        <label className="flex items-center gap-2 text-sm text-gray-600">
          <input type="checkbox" disabled={disabled} checked={!!draft.active} onChange={(e) => set("active", e.target.checked)} className="h-4 w-4 accent-brand-500" />
          Ativo
        </label>
      </div>

      <Field label="Descrição">
        <Input value={draft.description || ""} disabled={disabled} onChange={(e) => set("description", e.target.value)} placeholder="Ex.: Auto-resposta do WhatsApp de Reservas" />
      </Field>

      <Field label="Prompt do sistema (persona + regras)">
        <Textarea
          value={draft.system_prompt || ""}
          disabled={disabled}
          onChange={(e) => set("system_prompt", e.target.value)}
          rows={12}
          className="font-mono text-xs leading-relaxed"
          placeholder="Quem é o agente, o que faz, tom, regras de segurança…"
        />
        <p className="mt-1 text-[11px] text-gray-400">A plataforma anexa automaticamente contexto dinâmico (data, nome do contato, horário de atendimento) no fim do prompt.</p>
      </Field>

      {/* LLM */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Provider">
          <Select value={provider} disabled={disabled} onChange={(e) => { const p = e.target.value as AiProvider; set("provider", p); const first = (PROVIDER_MODELS[p] || [])[0]?.value; if (first) set("model", first); }}>
            <option value="openai">OpenAI</option>
            <option value="anthropic">Anthropic (futuro)</option>
            <option value="google">Google (futuro)</option>
            <option value="custom">Custom (futuro)</option>
          </Select>
          {!providerExecuted && <p className="mt-1 text-[11px] text-amber-600">Só OpenAI é executado nesta fase; será usado o modelo padrão do OpenAI até a integração.</p>}
        </Field>
        <Field label="Modelo">
          <Select value={draft.model || ""} disabled={disabled} onChange={(e) => set("model", e.target.value)}>
            {models.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
          </Select>
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label={`Temperatura (${(draft.temperature ?? 0.4).toFixed(2)})`}>
          <input type="range" min={0} max={2} step={0.05} disabled={disabled} value={draft.temperature ?? 0.4} onChange={(e) => set("temperature", Number(e.target.value))} className="w-full accent-brand-500" />
        </Field>
        <Field label="Máx. tokens (vazio = padrão)">
          <Input type="number" min={1} disabled={disabled} value={draft.max_tokens ?? ""} onChange={(e) => set("max_tokens", e.target.value ? Number(e.target.value) : null)} placeholder="auto" />
        </Field>
        <Field label={`top_p (${(draft.top_p ?? 1).toFixed(2)})`}>
          <input type="range" min={0} max={1} step={0.05} disabled={disabled} value={draft.top_p ?? 1} onChange={(e) => set("top_p", Number(e.target.value))} className="w-full accent-brand-500" />
        </Field>
      </div>

      {/* Ferramentas */}
      <Field label="Ferramentas disponíveis">
        <div className="grid gap-1.5 sm:grid-cols-2">
          {TOOL_CATALOG.map((t) => {
            const checked = (draft.tools || []).includes(t.name);
            return (
              <label key={t.name} className={cn("flex cursor-pointer items-start gap-2 rounded-lg border p-2 text-xs", checked ? "border-brand-300 bg-brand-50/40" : "border-gray-200 hover:bg-gray-50")}>
                <input type="checkbox" disabled={disabled} checked={checked} onChange={() => toggleTool(t.name)} className="mt-0.5 h-3.5 w-3.5 accent-brand-500" />
                <span>
                  <span className="font-medium text-gray-800">{t.label}</span>
                  {!t.leadSafe && <span className="ml-1 rounded bg-amber-100 px-1 text-[9px] font-semibold text-amber-700">interno</span>}
                  <span className="block text-[11px] text-gray-500">{t.description}</span>
                </span>
              </label>
            );
          })}
        </div>
        <p className="mt-1 text-[11px] text-gray-400">Em canais de leads (WhatsApp), ferramentas marcadas como “interno” são ignoradas por segurança, mesmo se selecionadas.</p>
      </Field>

      {/* Conhecimento */}
      <Field label="Fonte de conhecimento">
        <Select value={draft.knowledge_source || "tools"} disabled={disabled} onChange={(e) => set("knowledge_source", e.target.value as AiAgent["knowledge_source"])}>
          <option value="tools">Base do sistema (via ferramentas search_knowledge / guias)</option>
          <option value="manual">Manual (FAQ + URLs injetados no prompt)</option>
          <option value="none">Nenhuma</option>
        </Select>
      </Field>

      {draft.knowledge_source === "manual" && (
        <>
          <FaqEditor value={draft.faq || []} disabled={disabled} onChange={(faq) => set("faq", faq)} />
          <ChipsField label="URLs de referência" value={draft.knowledge_urls || []} disabled={disabled} placeholder="https://…" onChange={(v) => set("knowledge_urls", v)} />
        </>
      )}

      {/* Comportamento */}
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex items-center gap-2 self-end pb-2 text-sm text-gray-700">
          <input type="checkbox" disabled={disabled} checked={draft.fallback_human !== false} onChange={(e) => set("fallback_human", e.target.checked)} className="h-4 w-4 accent-brand-500" />
          Passar para humano quando não souber
        </label>
        <ChipsField label="Palavras-gatilho de handoff" value={draft.handoff_keywords || []} disabled={disabled} placeholder="falar com humano" onChange={(v) => set("handoff_keywords", v)} />
      </div>

      {/* Execução */}
      <Field label="Execução">
        <div className="flex flex-wrap gap-2">
          {(["api_route", "n8n"] as const).map((ex) => (
            <button
              key={ex}
              type="button"
              disabled={disabled}
              onClick={() => set("execution", ex)}
              className={cn("rounded-lg border px-3 py-2 text-xs font-medium", (draft.execution || "api_route") === ex ? "border-brand-400 bg-brand-50 text-brand-700" : "border-gray-200 text-gray-600 hover:bg-gray-50")}
            >
              {ex === "api_route" ? "Plataforma (rota Next.js)" : "n8n (workflow externo)"}
            </button>
          ))}
        </div>
      </Field>
      {draft.execution === "n8n" && (
        <Field label="URL do workflow n8n (opcional)">
          <Input value={draft.n8n_url || ""} disabled={disabled} onChange={(e) => set("n8n_url", e.target.value || null)} placeholder="https://n8n…/webhook/…" />
          <p className="mt-1 text-[11px] text-gray-400">O n8n lê a config completa deste agente por <span className="font-mono">GET /api/ai/agents/resolve?line_id=…</span> (fonte única).</p>
        </Field>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Histórico (nº de mensagens)">
          <Input type="number" min={1} max={100} disabled={disabled} value={draft.history_limit ?? 20} onChange={(e) => set("history_limit", Number(e.target.value))} />
        </Field>
        <Field label="Máx. loops de ferramenta">
          <Input type="number" min={1} max={10} disabled={disabled} value={draft.max_tool_loops ?? 3} onChange={(e) => set("max_tool_loops", Number(e.target.value))} />
        </Field>
      </div>

      {/* Ações */}
      {canEdit && (
        <div className="flex items-center justify-between border-t border-gray-100 pt-4">
          {!isNew ? (
            <Button variant="ghost" className="text-red-600 hover:bg-red-50" onClick={() => setConfirmDelete(true)}>
              <Trash2 size={15} /> Remover
            </Button>
          ) : <span />}
          <Button onClick={save} disabled={busy}>
            {busy ? <Loader2 className="animate-spin" size={15} /> : <Save size={15} />} Salvar
          </Button>
        </div>
      )}

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Remover agente?"
        description={`"${draft.name}" e seus vínculos serão removidos. As linhas voltam ao comportamento padrão.`}
        confirmLabel="Remover"
        variant="danger"
        onConfirm={() => { setConfirmDelete(false); remove(); }}
      />
    </div>
  );
}

// ─── Bindings ────────────────────────────────────────────────────────────
function BindingsCard({
  lines,
  agents,
  bindings,
  canEdit,
  onChanged,
}: {
  lines: LineLite[];
  agents: AiAgent[];
  bindings: AiBindingView[];
  canEdit: boolean;
  onChanged: () => Promise<unknown>;
}) {
  const bindByLine = useMemo(() => {
    const m = new Map<string, string>();
    bindings.forEach((b) => { if (b.line_id) m.set(b.line_id, b.agent_id); });
    return m;
  }, [bindings]);

  async function setLine(lineId: string, agentId: string) {
    try {
      if (agentId === "") {
        await api("/api/ai/agents/bindings", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ line_id: lineId }) });
      } else {
        await api("/api/ai/agents/bindings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ agent_id: agentId, line_id: lineId }) });
      }
      await onChanged();
      toast({ title: "Vínculo atualizado", variant: "success" });
    } catch (e) {
      toast({ title: "Erro", description: e instanceof Error ? e.message : "", variant: "error" });
    }
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="mb-1 flex items-center gap-2">
        <Sparkles size={14} className="text-brand-500" />
        <h3 className="text-sm font-semibold text-gray-900">Vínculos por canal</h3>
      </div>
      <p className="mb-3 text-[11px] text-gray-400">Qual agente atende cada linha do WhatsApp.</p>
      <ul className="space-y-2">
        {lines.map((l) => (
          <li key={l.id} className="rounded-lg border border-gray-100 bg-gray-50/50 p-2">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-sm font-medium text-gray-800">{l.label}</span>
              <span className={cn("text-[10px]", l.ai_enabled ? "text-emerald-600" : "text-gray-400")}>{l.ai_enabled ? "IA ligada" : "IA desligada"}</span>
            </div>
            <Select
              value={bindByLine.get(l.id) || ""}
              disabled={!canEdit}
              onChange={(e) => setLine(l.id, e.target.value)}
            >
              <option value="">— Sem agente (padrão) —</option>
              {agents.map((a) => <option key={a.id} value={a.id}>{a.name}{a.active ? "" : " (inativo)"}</option>)}
            </Select>
          </li>
        ))}
        {lines.length === 0 && <li className="py-4 text-center text-xs text-gray-400">Nenhuma linha WhatsApp cadastrada.</li>}
      </ul>
    </div>
  );
}

// ─── Sub-inputs ──────────────────────────────────────────────────────────
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-gray-600">{label}</label>
      {children}
    </div>
  );
}

function FaqEditor({ value, disabled, onChange }: { value: FaqEntry[]; disabled: boolean; onChange: (v: FaqEntry[]) => void }) {
  return (
    <Field label="FAQ (perguntas e respostas)">
      <div className="space-y-2">
        {value.map((f, i) => (
          <div key={i} className="rounded-lg border border-gray-200 p-2">
            <div className="flex items-center gap-2">
              <Input value={f.q} disabled={disabled} placeholder="Pergunta" onChange={(e) => { const n = [...value]; n[i] = { ...n[i], q: e.target.value }; onChange(n); }} />
              <button type="button" disabled={disabled} onClick={() => onChange(value.filter((_, j) => j !== i))} className="text-gray-300 hover:text-red-500"><X size={15} /></button>
            </div>
            <Textarea value={f.a} disabled={disabled} rows={2} placeholder="Resposta" className="mt-1 text-xs" onChange={(e) => { const n = [...value]; n[i] = { ...n[i], a: e.target.value }; onChange(n); }} />
          </div>
        ))}
        {!disabled && (
          <Button variant="secondary" size="sm" onClick={() => onChange([...value, { q: "", a: "" }])}>
            <Plus size={14} /> Adicionar pergunta
          </Button>
        )}
      </div>
    </Field>
  );
}

function ChipsField({ label, value, disabled, placeholder, onChange }: { label: string; value: string[]; disabled: boolean; placeholder?: string; onChange: (v: string[]) => void }) {
  const [text, setText] = useState("");
  function add() {
    const v = text.trim();
    if (!v) return;
    if (!value.includes(v)) onChange([...value, v]);
    setText("");
  }
  return (
    <Field label={label}>
      <div className="flex flex-wrap gap-1.5">
        {value.map((v, i) => (
          <span key={i} className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-700">
            {v}
            {!disabled && <button type="button" onClick={() => onChange(value.filter((_, j) => j !== i))} className="opacity-50 hover:opacity-100"><X size={11} /></button>}
          </span>
        ))}
      </div>
      {!disabled && (
        <div className="mt-1.5 flex gap-2">
          <Input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} placeholder={placeholder} />
          <Button variant="secondary" size="sm" onClick={add}><Plus size={14} /></Button>
        </div>
      )}
    </Field>
  );
}
