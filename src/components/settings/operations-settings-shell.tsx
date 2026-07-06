"use client";

import { useEffect, useState } from "react";
import {
  Loader2, AlertCircle, Check, Plus, Pencil, Trash2, X, ClipboardList,
  CalendarClock, HardDrive, Play,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { TASK_TYPES, TASK_TYPE_LABELS } from "@/lib/validations/task";
import type {
  AutomationSettings,
  RetentionSettings,
} from "@/lib/validations/operations";
import type { ChecklistTemplateRow } from "@/lib/db/queries/checklists";
import { useToast } from "@/components/ui/use-toast";

interface ApiResp<T> { success: boolean; data?: T; error?: string }
async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init);
  const json = (await res.json()) as ApiResp<T>;
  if (!json.success) throw new Error(json.error || `HTTP ${res.status}`);
  return json.data as T;
}

interface PropertyOption { id: string; name: string; code: string }

export function OperationsSettingsShell() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [automation, setAutomation] = useState<AutomationSettings | null>(null);
  const [retention, setRetention] = useState<RetentionSettings | null>(null);
  const [templates, setTemplates] = useState<ChecklistTemplateRow[]>([]);
  const [properties, setProperties] = useState<PropertyOption[]>([]);
  const [editing, setEditing] = useState<ChecklistTemplateRow | "new" | null>(null);

  const reload = async () => {
    setLoading(true); setError(null);
    try {
      const [settings, tpls, props] = await Promise.all([
        api<{ automation: AutomationSettings; retention: RetentionSettings }>("/api/operations/settings"),
        api<ChecklistTemplateRow[]>("/api/operations/checklists"),
        api<PropertyOption[]>("/api/properties?status=active"),
      ]);
      setAutomation(settings.automation);
      setRetention(settings.retention);
      setTemplates(tpls);
      setProperties(props.map((p) => ({ id: p.id, name: p.name, code: p.code })));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao carregar");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { reload(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return <div className="p-10 flex justify-center text-gray-400"><Loader2 className="animate-spin" size={20} aria-hidden="true" /></div>;
  }
  if (error || !automation || !retention) {
    return (
      <div className="p-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2">
        <AlertCircle size={15} aria-hidden="true" /> {error || "Falha ao carregar"}
        <span className="text-xs text-red-400">(a migration 028 já foi aplicada?)</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <AutomationCard
        value={automation}
        onSaved={(a) => { setAutomation(a); toast({ title: "Automação salva" }); }}
      />
      <ChecklistsCard
        templates={templates}
        properties={properties}
        onEdit={(t) => setEditing(t)}
        onNew={() => setEditing("new")}
        onDeleted={(id) => { setTemplates((prev) => prev.filter((t) => t.id !== id)); toast({ title: "Template removido" }); }}
      />
      <RetentionCard
        value={retention}
        onSaved={(r) => { setRetention(r); toast({ title: "Retenção salva" }); }}
      />

      {editing && (
        <TemplateModal
          template={editing === "new" ? null : editing}
          properties={properties}
          onClose={() => setEditing(null)}
          onSaved={(t) => {
            setTemplates((prev) => {
              const i = prev.findIndex((x) => x.id === t.id);
              if (i === -1) return [t, ...prev];
              const next = prev.slice(); next[i] = t; return next;
            });
            setEditing(null);
            toast({ title: "Template salvo" });
          }}
        />
      )}
    </div>
  );
}

// ─── Automação (auto-agendamento) ───

function AutomationCard({ value, onSaved }: { value: AutomationSettings; onSaved: (a: AutomationSettings) => void }) {
  const [form, setForm] = useState<AutomationSettings>(value);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const save = async () => {
    setBusy(true); setErr(null);
    try {
      const res = await api<{ automation: AutomationSettings }>("/api/operations/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ automation: form }),
      });
      onSaved(res.automation);
    } catch (e) { setErr(e instanceof Error ? e.message : "Falha ao salvar"); }
    finally { setBusy(false); }
  };

  const dirty = JSON.stringify(form) !== JSON.stringify(value);

  return (
    <Card icon={CalendarClock} title="Auto-agendamento de limpeza" desc="Tarefas criadas automaticamente a partir das reservas. A camareira pode reagendar cada tarefa.">
      <div className="space-y-3">
        <ToggleRow
          label="Limpeza pós-checkout"
          hint="Criada quando o hóspede faz checkout (e com antecedência pela varredura diária)."
          checked={form.checkout_clean_enabled}
          onChange={(v) => setForm({ ...form, checkout_clean_enabled: v })}
        >
          <HoursInput
            label="horas após o checkout"
            value={form.checkout_offset_hours}
            disabled={!form.checkout_clean_enabled}
            onChange={(v) => setForm({ ...form, checkout_offset_hours: v })}
          />
        </ToggleRow>
        <ToggleRow
          label="Preparo pré-check-in"
          hint="Criada quando a reserva é confirmada, com prazo antes da entrada do hóspede."
          checked={form.checkin_prep_enabled}
          onChange={(v) => setForm({ ...form, checkin_prep_enabled: v })}
        >
          <HoursInput
            label="horas antes do check-in"
            value={form.checkin_offset_hours}
            disabled={!form.checkin_prep_enabled}
            onChange={(v) => setForm({ ...form, checkin_offset_hours: v })}
          />
        </ToggleRow>
        <p className="text-[11px] text-gray-400">
          Os horários-base vêm de cada imóvel (check-in/checkout). Ex.: checkout 11:00 + 0h = limpeza às 11:00;
          check-in 15:00 − 4h = preparo às 11:00.
        </p>
        {err && <div className="text-xs text-red-500 flex items-center gap-1"><AlertCircle size={12} aria-hidden="true" /> {err}</div>}
        <div className="flex justify-end">
          <button onClick={save} disabled={busy || !dirty} className="bg-brand-500 hover:bg-brand-600 disabled:bg-gray-200 disabled:text-gray-400 text-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-1.5 transition-colors duration-200">
            {busy && <Loader2 className="animate-spin" size={14} aria-hidden="true" />} Salvar automação
          </button>
        </div>
      </div>
    </Card>
  );
}

// ─── Checklists (templates) ───

function ChecklistsCard({
  templates, properties, onEdit, onNew, onDeleted,
}: {
  templates: ChecklistTemplateRow[];
  properties: PropertyOption[];
  onEdit: (t: ChecklistTemplateRow) => void;
  onNew: () => void;
  onDeleted: (id: string) => void;
}) {
  const [deleting, setDeleting] = useState<string | null>(null);

  const scopeLabel = (t: ChecklistTemplateRow) => {
    if (!t.property_ids || t.property_ids.length === 0) return "Todas as unidades";
    if (t.property_ids.length === 1) {
      const p = properties.find((x) => x.id === t.property_ids[0]);
      return p ? `${p.name}` : "1 unidade";
    }
    return `${t.property_ids.length} unidades`;
  };

  const remove = async (t: ChecklistTemplateRow) => {
    if (!confirm(`Remover o template "${t.name}"?`)) return;
    setDeleting(t.id);
    try {
      await api(`/api/operations/checklists/${t.id}`, { method: "DELETE" });
      onDeleted(t.id);
    } catch { /* toast já cobre o sucesso; erro fica silencioso aqui */ }
    finally { setDeleting(null); }
  };

  return (
    <Card
      icon={ClipboardList}
      title="Templates de checklist"
      desc="O template ativo do contexto (tipo de tarefa × unidade) preenche o checklist de cada tarefa nova. Template de unidade vence o geral."
      action={
        <button onClick={onNew} className="bg-brand-500 hover:bg-brand-600 text-white px-3 py-1.5 rounded-lg text-sm font-semibold flex items-center gap-1.5 transition-colors duration-200">
          <Plus size={14} aria-hidden="true" /> Novo template
        </button>
      }
    >
      {templates.length === 0 ? (
        <div className="text-center text-sm text-gray-400 py-6">Nenhum template. Crie o primeiro.</div>
      ) : (
        <div className="divide-y divide-gray-100 -mx-4">
          {templates.map((t) => (
            <div key={t.id} className={cn("flex items-center gap-3 px-4 py-2.5", !t.is_active && "opacity-50")}>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-gray-900 truncate flex items-center gap-2">
                  {t.name}
                  {!t.is_active && <span className="text-[10px] font-bold uppercase text-gray-400 border border-gray-200 rounded px-1">inativo</span>}
                </div>
                <div className="text-[11px] text-gray-500">
                  {TASK_TYPE_LABELS[t.task_type]} · {t.items.length} itens · {scopeLabel(t)}
                </div>
              </div>
              <button onClick={() => onEdit(t)} title="Editar" aria-label={`Editar ${t.name}`} className="text-gray-500 hover:text-brand-600 p-1.5 rounded hover:bg-gray-100 transition-colors duration-200">
                <Pencil size={14} aria-hidden="true" />
              </button>
              <button onClick={() => remove(t)} disabled={deleting === t.id} title="Remover" aria-label={`Remover ${t.name}`} className="text-gray-400 hover:text-rose-600 p-1.5 rounded hover:bg-gray-100 transition-colors duration-200">
                {deleting === t.id ? <Loader2 className="animate-spin" size={14} aria-hidden="true" /> : <Trash2 size={14} aria-hidden="true" />}
              </button>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function TemplateModal({
  template, properties, onClose, onSaved,
}: {
  template: ChecklistTemplateRow | null;
  properties: PropertyOption[];
  onClose: () => void;
  onSaved: (t: ChecklistTemplateRow) => void;
}) {
  const [name, setName] = useState(template?.name || "");
  const [taskType, setTaskType] = useState<(typeof TASK_TYPES)[number]>(template?.task_type || "checkout_clean");
  const [items, setItems] = useState<{ id: string; label: string }[]>(template?.items || []);
  const [propertyIds, setPropertyIds] = useState<string[]>(template?.property_ids || []);
  const [isActive, setIsActive] = useState(template?.is_active ?? true);
  const [newItem, setNewItem] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const uid = () => {
    try { return crypto.randomUUID().slice(0, 8); } catch { return Math.random().toString(36).slice(2, 10); }
  };

  const addItem = () => {
    const label = newItem.trim();
    if (!label) return;
    setItems((prev) => [...prev, { id: uid(), label }]);
    setNewItem("");
  };

  const toggleProperty = (id: string) => {
    setPropertyIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const save = async () => {
    setBusy(true); setErr(null);
    try {
      const body = JSON.stringify({ name: name.trim(), task_type: taskType, items, property_ids: propertyIds, is_active: isActive });
      const saved = template
        ? await api<ChecklistTemplateRow>(`/api/operations/checklists/${template.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body })
        : await api<ChecklistTemplateRow>("/api/operations/checklists", { method: "POST", headers: { "Content-Type": "application/json" }, body });
      onSaved(saved);
    } catch (e) { setErr(e instanceof Error ? e.message : "Falha ao salvar"); }
    finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between shrink-0">
          <h3 className="font-semibold text-sm text-gray-900">{template ? `Editar · ${template.name}` : "Novo template de checklist"}</h3>
          <button onClick={onClose} aria-label="Fechar" className="text-gray-400 hover:text-gray-600 p-1 rounded hover:bg-gray-100 transition-colors duration-200"><X size={16} aria-hidden="true" /></button>
        </div>
        <div className="p-4 overflow-y-auto space-y-4">
          <Field label="Nome *">
            <input value={name} onChange={(e) => setName(e.target.value)} className="op-input" placeholder="Limpeza de saída — casas de praia" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Tipo de tarefa">
              <select value={taskType} onChange={(e) => setTaskType(e.target.value as (typeof TASK_TYPES)[number])} className="op-input bg-white">
                {TASK_TYPES.map((t) => <option key={t} value={t}>{TASK_TYPE_LABELS[t]}</option>)}
              </select>
            </Field>
            <Field label="Status">
              <label className="flex items-center gap-2 text-sm mt-2">
                <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
                <span>Ativo</span>
              </label>
            </Field>
          </div>

          <Field label={`Itens do checklist (${items.length})`}>
            <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-52 overflow-y-auto">
              {items.length === 0 && <div className="px-3 py-4 text-center text-xs text-gray-400">Sem itens. Adicione abaixo.</div>}
              {items.map((it) => (
                <div key={it.id} className="flex items-center gap-2 px-3 py-1.5">
                  <span className="flex-1 text-sm text-gray-800">{it.label}</span>
                  <button onClick={() => setItems((prev) => prev.filter((x) => x.id !== it.id))} aria-label="Remover item" className="text-gray-300 hover:text-rose-500 p-0.5"><X size={14} aria-hidden="true" /></button>
                </div>
              ))}
            </div>
            <div className="flex gap-2 mt-2">
              <input value={newItem} onChange={(e) => setNewItem(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addItem(); } }} placeholder="Adicionar item…" className="op-input flex-1" />
              <button onClick={addItem} aria-label="Adicionar item" className="px-3 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors duration-150"><Plus size={16} aria-hidden="true" /></button>
            </div>
          </Field>

          <Field label="Unidades" hint="Nenhuma selecionada = vale para todas. Só existe um template ativo por contexto (unidade específica vence o geral).">
            <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-44 overflow-y-auto">
              {properties.map((p) => (
                <label key={p.id} className="flex items-center gap-2 px-3 py-1.5 text-sm cursor-pointer hover:bg-gray-50">
                  <input type="checkbox" checked={propertyIds.includes(p.id)} onChange={() => toggleProperty(p.id)} />
                  <span className="text-gray-800">{p.name}</span>
                  <span className="text-[11px] text-gray-400">({p.code})</span>
                </label>
              ))}
              {properties.length === 0 && <div className="px-3 py-3 text-xs text-gray-400">Nenhum imóvel ativo.</div>}
            </div>
          </Field>

          {err && <div className="text-xs text-red-500 flex items-center gap-1"><AlertCircle size={12} aria-hidden="true" /> {err}</div>}
        </div>
        <div className="px-4 py-3 border-t border-gray-100 flex justify-end gap-2 shrink-0">
          <button onClick={onClose} className="px-3 py-2 text-sm rounded-lg text-gray-600 hover:bg-gray-50 transition-colors duration-200">Cancelar</button>
          <button onClick={save} disabled={busy || !name.trim() || items.length === 0} className="bg-brand-500 hover:bg-brand-600 disabled:bg-gray-300 text-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-1.5 transition-colors duration-200">
            {busy && <Loader2 className="animate-spin" size={14} aria-hidden="true" />} Salvar template
          </button>
        </div>
      </div>
      <style jsx global>{`.op-input { width: 100%; padding: 0.5rem 0.75rem; font-size: 0.875rem; border-radius: 0.5rem; border: 1px solid rgb(229,231,235); }
       .op-input:focus { outline: none; border-color: rgb(107,127,94); box-shadow: 0 0 0 3px rgba(107,127,94,0.15); }`}</style>
    </div>
  );
}

// ─── Retenção de storage (#14) ───

function RetentionCard({ value, onSaved }: { value: RetentionSettings; onSaved: (r: RetentionSettings) => void }) {
  const [form, setForm] = useState<RetentionSettings>(value);
  const [busy, setBusy] = useState(false);
  const [running, setRunning] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [runResult, setRunResult] = useState<string | null>(null);

  const save = async () => {
    setBusy(true); setErr(null);
    try {
      const res = await api<{ retention: RetentionSettings }>("/api/operations/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ retention: form }),
      });
      onSaved(res.retention);
    } catch (e) { setErr(e instanceof Error ? e.message : "Falha ao salvar"); }
    finally { setBusy(false); }
  };

  const runNow = async () => {
    setRunning(true); setErr(null); setRunResult(null);
    try {
      const res = await api<{ removed: number; scanned: number; enabled: boolean }>("/api/operations/retention/run", { method: "POST" });
      setRunResult(
        res.enabled
          ? `${res.removed} arquivo(s) removido(s) de ${res.scanned} elegível(is).`
          : "Retenção desativada — nada foi removido."
      );
    } catch (e) { setErr(e instanceof Error ? e.message : "Falha ao executar"); }
    finally { setRunning(false); }
  };

  const dirty = JSON.stringify(form) !== JSON.stringify(value);

  return (
    <Card icon={HardDrive} title="Retenção de mídia (storage)" desc="Remove fotos e vídeos de tarefas CONCLUÍDAS há mais de N dias. Roda diariamente via automação (n8n) — ou manualmente aqui.">
      <div className="space-y-3">
        <ToggleRow
          label="Retenção ativa"
          hint="Mídia do WhatsApp e fotos dos imóveis não são afetadas."
          checked={form.enabled}
          onChange={(v) => setForm({ ...form, enabled: v })}
        >
          <span className="flex items-center gap-2 text-sm text-gray-600">
            <input
              type="number"
              min={7}
              max={3650}
              value={form.days}
              disabled={!form.enabled}
              onChange={(e) => setForm({ ...form, days: Math.max(7, Math.min(3650, Number(e.target.value) || 7)) })}
              className="w-20 rounded-lg border border-gray-200 px-2 py-1.5 text-sm text-right disabled:bg-gray-50 disabled:text-gray-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40"
            />
            dias após a conclusão
          </span>
        </ToggleRow>
        {err && <div className="text-xs text-red-500 flex items-center gap-1"><AlertCircle size={12} aria-hidden="true" /> {err}</div>}
        {runResult && <div className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-2.5 py-1.5 flex items-center gap-1"><Check size={12} aria-hidden="true" /> {runResult}</div>}
        <div className="flex justify-between items-center gap-2 flex-wrap">
          <button onClick={runNow} disabled={running} className="text-sm font-semibold text-gray-600 hover:text-gray-800 border border-gray-200 hover:bg-gray-50 px-3 py-2 rounded-lg flex items-center gap-1.5 transition-colors duration-200">
            {running ? <Loader2 className="animate-spin" size={14} aria-hidden="true" /> : <Play size={14} aria-hidden="true" />} Executar agora
          </button>
          <button onClick={save} disabled={busy || !dirty} className="bg-brand-500 hover:bg-brand-600 disabled:bg-gray-200 disabled:text-gray-400 text-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-1.5 transition-colors duration-200">
            {busy && <Loader2 className="animate-spin" size={14} aria-hidden="true" />} Salvar retenção
          </button>
        </div>
      </div>
    </Card>
  );
}

// ─── Blocos compartilhados ───

function Card({
  icon: Icon, title, desc, action, children,
}: {
  icon: React.ElementType; title: string; desc: string;
  action?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <section className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 space-y-3">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-brand-500/10 flex items-center justify-center shrink-0">
          <Icon className="text-brand-600" size={18} aria-hidden="true" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="font-semibold text-sm text-gray-900">{title}</h2>
          <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function ToggleRow({
  label, hint, checked, onChange, children,
}: {
  label: string; hint?: string; checked: boolean;
  onChange: (v: boolean) => void; children?: React.ReactNode;
}) {
  return (
    <div className="border border-gray-100 rounded-lg p-3 flex items-start gap-3 flex-wrap">
      <label className="flex items-center gap-2 cursor-pointer min-w-[220px] flex-1">
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-gray-900">{label}</span>
          {hint && <span className="block text-[11px] text-gray-400 leading-snug">{hint}</span>}
        </span>
      </label>
      {children}
    </div>
  );
}

function HoursInput({
  label, value, disabled, onChange,
}: {
  label: string; value: number; disabled?: boolean; onChange: (v: number) => void;
}) {
  return (
    <span className="flex items-center gap-2 text-sm text-gray-600">
      <input
        type="number"
        min={0}
        max={72}
        step={1}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Math.max(0, Math.min(72, Number(e.target.value) || 0)))}
        className="w-16 rounded-lg border border-gray-200 px-2 py-1.5 text-sm text-right disabled:bg-gray-50 disabled:text-gray-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40"
      />
      {label}
    </span>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[11px] text-gray-500 uppercase tracking-wider font-semibold">{label}</label>
      {children}
      {hint && <div className="text-[10px] text-gray-400 mt-1">{hint}</div>}
    </div>
  );
}
