"use client";

// ===========================================================================
// Precificação — shell com abas (Fase 4)
//   Regras · Grupos · Feriados · Tarifa sugerida · Simulador
// ===========================================================================

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Plus,
  Loader2,
  Pencil,
  Trash2,
  SlidersHorizontal,
  Boxes,
  CalendarHeart,
  TrendingUp,
  CalendarSearch,
} from "lucide-react";
import {
  Button,
  Badge,
  ConfirmDialog,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
} from "@/components/ui";
import { cn } from "@/lib/utils/cn";
import { api } from "@/lib/chat/utils";
import { toast } from "@/components/ui/use-toast";
import { formatCurrency } from "@/lib/utils/format";
import {
  DAY_LABELS,
  RULE_KIND_LABELS,
  type Holiday,
  type PricingRule,
  type PropertyGroup,
  type RuleAdjustmentType,
  type RuleKind,
  type RuleTargetType,
} from "@/types/pricing";
import { GroupsTab } from "@/components/pricing/groups-tab";
import { HolidaysTab } from "@/components/pricing/holidays-tab";
import { SuggestionsTab } from "@/components/pricing/suggestions-tab";
import { PriceCalendar } from "@/components/pricing/price-calendar";

export interface PropertyLite {
  id: string;
  name: string;
  code: string;
  base_price_cents: number;
}

type TabId = "rules" | "groups" | "holidays" | "suggestions" | "simulator";

const TABS: Array<{ id: TabId; label: string; icon: typeof SlidersHorizontal }> = [
  { id: "rules", label: "Regras", icon: SlidersHorizontal },
  { id: "groups", label: "Grupos", icon: Boxes },
  { id: "holidays", label: "Feriados", icon: CalendarHeart },
  { id: "suggestions", label: "Tarifa sugerida", icon: TrendingUp },
  { id: "simulator", label: "Simulador", icon: CalendarSearch },
];

export function PricingShell() {
  const [tab, setTab] = useState<TabId>("rules");
  const [loading, setLoading] = useState(true);
  const [rules, setRules] = useState<PricingRule[]>([]);
  const [groups, setGroups] = useState<PropertyGroup[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [properties, setProperties] = useState<PropertyLite[]>([]);

  const loadRules = useCallback(async () => {
    setRules(await api<PricingRule[]>("/api/pricing/rules"));
  }, []);
  const loadGroups = useCallback(async () => {
    setGroups(await api<PropertyGroup[]>("/api/pricing/groups"));
  }, []);
  const loadHolidays = useCallback(async () => {
    setHolidays(await api<Holiday[]>("/api/pricing/holidays"));
  }, []);

  useEffect(() => {
    Promise.all([
      loadRules(),
      loadGroups(),
      loadHolidays(),
      api<Array<PropertyLite & Record<string, unknown>>>("/api/properties").then((list) =>
        setProperties(
          list.map((p) => ({
            id: p.id,
            name: p.name,
            code: p.code,
            base_price_cents: p.base_price_cents,
          }))
        )
      ),
    ])
      .catch(() => toast({ title: "Erro ao carregar precificação", variant: "error" }))
      .finally(() => setLoading(false));
  }, [loadRules, loadGroups, loadHolidays]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-gray-400">
        <Loader2 className="animate-spin" size={20} aria-hidden="true" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Abas */}
      <div className="flex gap-1 overflow-x-auto rounded-lg border border-gray-200 bg-gray-50 p-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "flex shrink-0 items-center gap-2 rounded-md px-3.5 py-1.5 text-sm font-medium transition-colors",
              tab === t.id ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
            )}
          >
            <t.icon size={14} aria-hidden="true" />
            {t.label}
          </button>
        ))}
      </div>

      {tab === "rules" && (
        <RulesTab rules={rules} groups={groups} properties={properties} onChanged={loadRules} />
      )}
      {tab === "groups" && (
        <GroupsTab groups={groups} properties={properties} onChanged={loadGroups} />
      )}
      {tab === "holidays" && <HolidaysTab holidays={holidays} onChanged={loadHolidays} />}
      {tab === "suggestions" && <SuggestionsTab onApplied={loadRules} />}
      {tab === "simulator" && <PriceCalendar properties={properties} />}
    </div>
  );
}

// ─── Regras ──────────────────────────────────────────────────────────────────

function targetLabel(rule: PricingRule, groups: PropertyGroup[], properties: PropertyLite[]): string {
  if (rule.target_type === "group") {
    return `Grupo: ${groups.find((g) => g.id === rule.group_id)?.name ?? "—"}`;
  }
  if (rule.target_type === "property") {
    return properties.find((p) => p.id === rule.property_id)?.name ?? "—";
  }
  return "Todos os imóveis";
}

function conditionLabel(rule: PricingRule): string {
  if (rule.kind === "season") {
    const fmt = (d: string | null) => (d ? d.split("-").reverse().join("/") : "");
    return `${fmt(rule.start_date)} — ${fmt(rule.end_date)}`;
  }
  if (rule.kind === "recurring") {
    return (rule.days_of_week ?? []).map((d) => DAY_LABELS[d]).join(", ");
  }
  return "Todos os feriados do calendário";
}

function adjustmentLabel(rule: PricingRule): string {
  if (rule.adjustment_type === "set") return `${formatCurrency(rule.price_cents ?? 0)}/noite`;
  const pct = Number(rule.percent ?? 0);
  return `${pct > 0 ? "+" : ""}${pct}%`;
}

const KIND_BADGE_TONE: Record<RuleKind, "warning" | "info" | "brand"> = {
  season: "warning",
  recurring: "info",
  holiday: "brand",
};

interface RulesTabProps {
  rules: PricingRule[];
  groups: PropertyGroup[];
  properties: PropertyLite[];
  onChanged: () => Promise<void> | void;
}

function RulesTab({ rules, groups, properties, onChanged }: RulesTabProps) {
  const [editing, setEditing] = useState<PricingRule | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState<PricingRule | null>(null);

  const openNew = () => {
    setEditing(null);
    setDialogOpen(true);
  };
  const openEdit = (rule: PricingRule) => {
    setEditing(rule);
    setDialogOpen(true);
  };

  const remove = async () => {
    if (!deleting) return;
    try {
      await api(`/api/pricing/rules/${deleting.id}`, { method: "DELETE" });
      toast({ title: "Regra excluída" });
      await onChanged();
    } catch (e) {
      toast({ title: "Erro ao excluir", description: e instanceof Error ? e.message : "", variant: "error" });
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-gray-500 max-w-xl">
          Camadas do preço/noite: <strong>base do imóvel → temporada → dias da semana → feriado</strong>.
          Cada camada sobrepõe (preço fixo) ou ajusta (%) a anterior; empates são decididos pela prioridade.
        </p>
        <Button onClick={openNew} size="sm">
          <Plus size={14} aria-hidden="true" /> Nova regra
        </Button>
      </div>

      {rules.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/60 py-12 text-center text-sm text-gray-400">
          Nenhuma regra ainda. Crie a primeira — ex.: “Alta temporada”, “Fim de semana +20%”.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-[11px] uppercase tracking-wider text-gray-400">
                <th className="px-4 py-3 font-semibold">Regra</th>
                <th className="px-4 py-3 font-semibold">Tipo</th>
                <th className="px-4 py-3 font-semibold">Aplica-se a</th>
                <th className="px-4 py-3 font-semibold">Condição</th>
                <th className="px-4 py-3 font-semibold">Ajuste</th>
                <th className="px-4 py-3 font-semibold">Prior.</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {rules.map((rule) => (
                <tr key={rule.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/60">
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {rule.name}
                    {rule.min_nights ? (
                      <span className="ml-2 text-[11px] text-gray-400">mín. {rule.min_nights} noites</span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={KIND_BADGE_TONE[rule.kind]} className="text-[11px]">
                      {RULE_KIND_LABELS[rule.kind]}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{targetLabel(rule, groups, properties)}</td>
                  <td className="px-4 py-3 text-gray-600">{conditionLabel(rule)}</td>
                  <td className="px-4 py-3 font-mono text-gray-900">{adjustmentLabel(rule)}</td>
                  <td className="px-4 py-3 text-gray-500">{rule.priority}</td>
                  <td className="px-4 py-3">
                    <Badge tone={rule.active ? "success" : "neutral"} className="text-[11px]">
                      {rule.active ? "Ativa" : "Inativa"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => openEdit(rule)}
                        className="rounded-md p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
                        aria-label={`Editar ${rule.name}`}
                      >
                        <Pencil size={14} aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleting(rule)}
                        className="rounded-md p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600"
                        aria-label={`Excluir ${rule.name}`}
                      >
                        <Trash2 size={14} aria-hidden="true" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <RuleDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        rule={editing}
        groups={groups}
        properties={properties}
        onSaved={onChanged}
      />

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Excluir regra?"
        description={`“${deleting?.name}” deixará de afetar os preços imediatamente.`}
        confirmLabel="Excluir"
        variant="danger"
        onConfirm={remove}
      />
    </div>
  );
}

// ─── Dialog de regra (criar/editar) ──────────────────────────────────────────

interface RuleDraft {
  name: string;
  kind: RuleKind;
  target_type: RuleTargetType;
  group_id: string;
  property_id: string;
  start_date: string;
  end_date: string;
  days_of_week: number[];
  adjustment_type: RuleAdjustmentType;
  price: string;
  percent: string;
  min_nights: string;
  priority: string;
  active: boolean;
}

const EMPTY_DRAFT: RuleDraft = {
  name: "",
  kind: "season",
  target_type: "all",
  group_id: "",
  property_id: "",
  start_date: "",
  end_date: "",
  days_of_week: [5, 6],
  adjustment_type: "set",
  price: "",
  percent: "",
  min_nights: "",
  priority: "0",
  active: true,
};

function draftFromRule(rule: PricingRule): RuleDraft {
  return {
    name: rule.name,
    kind: rule.kind,
    target_type: rule.target_type,
    group_id: rule.group_id ?? "",
    property_id: rule.property_id ?? "",
    start_date: rule.start_date ?? "",
    end_date: rule.end_date ?? "",
    days_of_week: rule.days_of_week ?? [5, 6],
    adjustment_type: rule.adjustment_type,
    price: rule.price_cents != null ? String(rule.price_cents / 100) : "",
    percent: rule.percent != null ? String(rule.percent) : "",
    min_nights: rule.min_nights != null ? String(rule.min_nights) : "",
    priority: String(rule.priority),
    active: rule.active,
  };
}

const inputClass =
  "w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-400/15";
const labelClass = "block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5";

interface RuleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rule: PricingRule | null;
  groups: PropertyGroup[];
  properties: PropertyLite[];
  onSaved: () => Promise<void> | void;
}

function RuleDialog({ open, onOpenChange, rule, groups, properties, onSaved }: RuleDialogProps) {
  const [draft, setDraft] = useState<RuleDraft>(EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setDraft(rule ? draftFromRule(rule) : EMPTY_DRAFT);
  }, [open, rule]);

  const set = <K extends keyof RuleDraft>(key: K, value: RuleDraft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const toggleDay = (day: number) =>
    setDraft((d) => ({
      ...d,
      days_of_week: d.days_of_week.includes(day)
        ? d.days_of_week.filter((x) => x !== day)
        : [...d.days_of_week, day].sort(),
    }));

  const payload = useMemo(
    () => ({
      name: draft.name.trim(),
      kind: draft.kind,
      target_type: draft.target_type,
      group_id: draft.group_id || null,
      property_id: draft.property_id || null,
      start_date: draft.start_date || null,
      end_date: draft.end_date || null,
      days_of_week: draft.days_of_week,
      adjustment_type: draft.adjustment_type,
      price: draft.price === "" ? null : Number(draft.price),
      percent: draft.percent === "" ? null : Number(draft.percent),
      min_nights: draft.min_nights === "" ? null : Number(draft.min_nights),
      priority: Number(draft.priority) || 0,
      active: draft.active,
    }),
    [draft]
  );

  const save = async () => {
    setSaving(true);
    try {
      if (rule) {
        await api(`/api/pricing/rules/${rule.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        await api("/api/pricing/rules", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }
      toast({ title: rule ? "Regra atualizada" : "Regra criada" });
      onOpenChange(false);
      await onSaved();
    } catch (e) {
      toast({ title: "Erro ao salvar", description: e instanceof Error ? e.message : "", variant: "error" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{rule ? "Editar regra" : "Nova regra de preço"}</DialogTitle>
        </DialogHeader>
        <DialogBody className="space-y-4">
          <div>
            <label className={labelClass}>Nome *</label>
            <input
              value={draft.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="Ex.: Alta temporada, Fim de semana +20%"
              className={inputClass}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Tipo *</label>
              <select
                value={draft.kind}
                onChange={(e) => set("kind", e.target.value as RuleKind)}
                className={cn(inputClass, "bg-white cursor-pointer")}
              >
                <option value="season">Temporada (período)</option>
                <option value="recurring">Dias da semana</option>
                <option value="holiday">Feriado</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Aplica-se a *</label>
              <select
                value={draft.target_type}
                onChange={(e) => set("target_type", e.target.value as RuleTargetType)}
                className={cn(inputClass, "bg-white cursor-pointer")}
              >
                <option value="all">Todos os imóveis</option>
                <option value="group">Um grupo</option>
                <option value="property">Um imóvel</option>
              </select>
            </div>
          </div>

          {draft.target_type === "group" && (
            <div>
              <label className={labelClass}>Grupo *</label>
              <select
                value={draft.group_id}
                onChange={(e) => set("group_id", e.target.value)}
                className={cn(inputClass, "bg-white cursor-pointer")}
              >
                <option value="">Selecione…</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          {draft.target_type === "property" && (
            <div>
              <label className={labelClass}>Imóvel *</label>
              <select
                value={draft.property_id}
                onChange={(e) => set("property_id", e.target.value)}
                className={cn(inputClass, "bg-white cursor-pointer")}
              >
                <option value="">Selecione…</option>
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.code})
                  </option>
                ))}
              </select>
            </div>
          )}

          {draft.kind === "season" && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Início *</label>
                <input
                  type="date"
                  value={draft.start_date}
                  onChange={(e) => set("start_date", e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Fim *</label>
                <input
                  type="date"
                  value={draft.end_date}
                  onChange={(e) => set("end_date", e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>
          )}

          {draft.kind === "recurring" && (
            <div>
              <label className={labelClass}>Dias da semana *</label>
              <div className="flex flex-wrap gap-1.5">
                {DAY_LABELS.map((label, day) => (
                  <button
                    key={day}
                    type="button"
                    onClick={() => toggleDay(day)}
                    className={cn(
                      "rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors",
                      draft.days_of_week.includes(day)
                        ? "border-brand-500 bg-brand-500 text-white"
                        : "border-gray-200 bg-white text-gray-500 hover:border-gray-300"
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {draft.kind === "holiday" && (
            <p className="rounded-lg bg-purple-50 px-3 py-2 text-xs text-purple-700">
              Vale para todas as datas do calendário de feriados (aba <strong>Feriados</strong>).
            </p>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Ajuste *</label>
              <select
                value={draft.adjustment_type}
                onChange={(e) => set("adjustment_type", e.target.value as RuleAdjustmentType)}
                className={cn(inputClass, "bg-white cursor-pointer")}
              >
                <option value="set">Preço fixo por noite</option>
                <option value="percent">Percentual (±%)</option>
              </select>
            </div>
            {draft.adjustment_type === "set" ? (
              <div>
                <label className={labelClass}>Preço/noite (R$) *</label>
                <input
                  type="number"
                  step="0.01"
                  min={0}
                  value={draft.price}
                  onChange={(e) => set("price", e.target.value)}
                  className={cn(inputClass, "font-mono")}
                />
              </div>
            ) : (
              <div>
                <label className={labelClass}>Percentual (%) *</label>
                <input
                  type="number"
                  step="1"
                  value={draft.percent}
                  onChange={(e) => set("percent", e.target.value)}
                  placeholder="20 = +20% · -10 = desconto"
                  className={cn(inputClass, "font-mono")}
                />
              </div>
            )}
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelClass}>Mín. noites</label>
              <input
                type="number"
                min={1}
                value={draft.min_nights}
                onChange={(e) => set("min_nights", e.target.value)}
                placeholder="—"
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Prioridade</label>
              <input
                type="number"
                min={0}
                value={draft.priority}
                onChange={(e) => set("priority", e.target.value)}
                className={inputClass}
              />
            </div>
            <div className="flex items-end pb-1">
              <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={draft.active}
                  onChange={(e) => set("active", e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-brand-500 focus:ring-brand-400"
                />
                Ativa
              </label>
            </div>
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={save} loading={saving} disabled={saving || !draft.name.trim()}>
            {rule ? "Salvar" : "Criar regra"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
