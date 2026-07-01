"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Trash2, ChevronUp, ChevronDown, Star, Loader2, GripVertical } from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent, ConfirmDialog } from "@/components/ui";
import { cn } from "@/lib/utils/cn";
import { api } from "@/lib/chat/utils";
import { toast } from "@/components/ui/use-toast";
import {
  TAG_COLORS,
  FUNNEL_TYPES,
  FUNNEL_TYPE_META,
  type FunnelType,
  type FunnelPipeline,
  type FunnelStage,
  type Tag,
} from "@/types/funnel";

function ColorDot({ color, onChange, size = 18 }: { color: string; onChange: (c: string) => void; size?: number }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="rounded-full border-2 border-white shadow ring-1 ring-gray-200"
          style={{ background: color, width: size, height: size }}
          aria-label="Escolher cor"
        />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-2">
        <div className="grid grid-cols-5 gap-1.5">
          {TAG_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => onChange(c)}
              className={cn("h-6 w-6 rounded-full border-2", color === c ? "border-gray-800" : "border-transparent")}
              style={{ background: c }}
              aria-label={`Cor ${c}`}
            />
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function FunnelSettingsShell() {
  const [type, setType] = useState<FunnelType>("locacao");
  const [pipelines, setPipelines] = useState<FunnelPipeline[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [stages, setStages] = useState<FunnelStage[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);

  const loadPipelines = useCallback(async () => {
    const list = await api<FunnelPipeline[]>(`/api/funnel/pipelines?type=${type}`);
    setPipelines(list);
    setSelectedId((prev) => (prev && list.some((p) => p.id === prev) ? prev : list.find((p) => p.is_default)?.id ?? list[0]?.id ?? null));
  }, [type]);

  const loadTags = useCallback(async () => {
    setTags(await api<Tag[]>(`/api/funnel/tags?type=${type}`));
  }, [type]);

  const loadStages = useCallback(async () => {
    if (!selectedId) return setStages([]);
    setStages(await api<FunnelStage[]>(`/api/funnel/stages?pipeline_id=${selectedId}`));
  }, [selectedId]);

  useEffect(() => {
    setLoading(true);
    Promise.all([loadPipelines(), loadTags()]).finally(() => setLoading(false));
  }, [loadPipelines, loadTags]);

  useEffect(() => {
    loadStages();
  }, [loadStages]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-gray-400">
        <Loader2 className="animate-spin" size={20} />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Toggle de tipo */}
      <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-1">
        {FUNNEL_TYPES.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setType(t)}
            className={cn(
              "rounded-md px-4 py-1.5 text-sm font-medium transition-colors",
              type === t ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
            )}
          >
            {FUNNEL_TYPE_META[t].short}
          </button>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-[300px_1fr]">
        {/* Coluna esquerda: pipelines + tags */}
        <div className="space-y-5">
          <PipelinesCard
            type={type}
            pipelines={pipelines}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onChanged={loadPipelines}
          />
          <TagsCard type={type} tags={tags} onChanged={loadTags} />
        </div>

        {/* Coluna direita: etapas do pipeline selecionado */}
        <StagesCard pipelineId={selectedId} stages={stages} onChanged={loadStages} />
      </div>
    </div>
  );
}

// ─── Pipelines ───
function PipelinesCard({
  type,
  pipelines,
  selectedId,
  onSelect,
  onChanged,
}: {
  type: FunnelType;
  pipelines: FunnelPipeline[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onChanged: () => Promise<void> | void;
}) {
  const [name, setName] = useState("");
  const [color, setColor] = useState<string>("#c9a84c");
  const [busy, setBusy] = useState(false);
  const [toDelete, setToDelete] = useState<FunnelPipeline | null>(null);

  async function create() {
    if (!name.trim() || busy) return;
    setBusy(true);
    try {
      await api(`/api/funnel/pipelines`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, name: name.trim(), color }),
      });
      setName("");
      await onChanged();
      toast({ title: "Funil criado", variant: "success" });
    } catch (e) {
      toast({ title: "Erro", description: e instanceof Error ? e.message : "", variant: "error" });
    } finally {
      setBusy(false);
    }
  }

  async function setDefault(p: FunnelPipeline) {
    await api(`/api/funnel/pipelines/${p.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_default: true }),
    });
    await onChanged();
  }

  async function remove(p: FunnelPipeline) {
    try {
      await api(`/api/funnel/pipelines/${p.id}`, { method: "DELETE" });
      await onChanged();
      toast({ title: "Funil removido", variant: "success" });
    } catch (e) {
      toast({ title: "Não foi possível remover", description: e instanceof Error ? e.message : "", variant: "error" });
    }
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <h3 className="mb-3 text-sm font-semibold text-gray-900">Funis</h3>
      <ul className="space-y-1">
        {pipelines.map((p) => (
          <li key={p.id}>
            <div
              className={cn(
                "flex items-center gap-2 rounded-lg px-2 py-1.5",
                selectedId === p.id ? "bg-brand-50 ring-1 ring-brand-200" : "hover:bg-gray-50"
              )}
            >
              <button type="button" onClick={() => onSelect(p.id)} className="flex flex-1 items-center gap-2 text-left">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: p.color }} />
                <span className="truncate text-sm text-gray-800">{p.name}</span>
              </button>
              <button
                type="button"
                onClick={() => setDefault(p)}
                title={p.is_default ? "Funil padrão" : "Definir como padrão"}
                className={cn("shrink-0", p.is_default ? "text-amber-500" : "text-gray-300 hover:text-gray-400")}
              >
                <Star size={14} fill={p.is_default ? "currentColor" : "none"} />
              </button>
              {!p.is_default && (
                <button type="button" onClick={() => setToDelete(p)} className="shrink-0 text-gray-300 hover:text-red-500">
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex items-center gap-2 border-t border-gray-100 pt-3">
        <ColorDot color={color} onChange={setColor} />
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && create()}
          placeholder="Novo funil…"
          className="min-w-0 flex-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40"
        />
        <button
          type="button"
          onClick={create}
          disabled={busy || !name.trim()}
          className="rounded-lg bg-brand-500 p-1.5 text-white hover:bg-brand-600 disabled:opacity-50"
        >
          <Plus size={16} />
        </button>
      </div>
      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
        title="Remover funil?"
        description={`"${toDelete?.name}" será arquivado. Os negócios existentes permanecem no banco.`}
        confirmLabel="Remover"
        variant="danger"
        onConfirm={() => {
          if (toDelete) remove(toDelete);
          setToDelete(null);
        }}
      />
    </div>
  );
}

// ─── Stages ───
function StagesCard({
  pipelineId,
  stages,
  onChanged,
}: {
  pipelineId: string | null;
  stages: FunnelStage[];
  onChanged: () => Promise<void> | void;
}) {
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState<string>("#94a3b8");
  const [busy, setBusy] = useState(false);
  const [toDelete, setToDelete] = useState<FunnelStage | null>(null);

  async function addStage() {
    if (!newName.trim() || !pipelineId || busy) return;
    setBusy(true);
    try {
      await api(`/api/funnel/stages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pipeline_id: pipelineId, name: newName.trim(), color: newColor }),
      });
      setNewName("");
      await onChanged();
    } catch (e) {
      toast({ title: "Erro", description: e instanceof Error ? e.message : "", variant: "error" });
    } finally {
      setBusy(false);
    }
  }

  async function patch(id: string, body: Record<string, unknown>) {
    await api(`/api/funnel/stages/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    await onChanged();
  }

  async function reorder(from: number, to: number) {
    if (to < 0 || to >= stages.length || !pipelineId) return;
    const ids = stages.map((s) => s.id);
    const [moved] = ids.splice(from, 1);
    ids.splice(to, 0, moved);
    await api(`/api/funnel/stages/reorder`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pipeline_id: pipelineId, ordered_ids: ids }),
    });
    await onChanged();
  }

  async function remove(s: FunnelStage) {
    try {
      await api(`/api/funnel/stages/${s.id}`, { method: "DELETE" });
      await onChanged();
    } catch (e) {
      toast({ title: "Não foi possível remover", description: e instanceof Error ? e.message : "", variant: "error" });
    }
  }

  if (!pipelineId) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-400">
        Selecione ou crie um funil para configurar as etapas.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <h3 className="mb-3 text-sm font-semibold text-gray-900">Etapas</h3>
      <ul className="space-y-2">
        {stages.map((s, i) => (
          <li key={s.id} className="flex items-center gap-2 rounded-lg border border-gray-100 bg-gray-50/50 px-2.5 py-2">
            <div className="flex flex-col text-gray-300">
              <button type="button" onClick={() => reorder(i, i - 1)} disabled={i === 0} className="hover:text-gray-600 disabled:opacity-30">
                <ChevronUp size={13} />
              </button>
              <button type="button" onClick={() => reorder(i, i + 1)} disabled={i === stages.length - 1} className="hover:text-gray-600 disabled:opacity-30">
                <ChevronDown size={13} />
              </button>
            </div>
            <ColorDot color={s.color} onChange={(c) => patch(s.id, { color: c })} />
            <input
              defaultValue={s.name}
              onBlur={(e) => e.target.value.trim() && e.target.value !== s.name && patch(s.id, { name: e.target.value.trim() })}
              className="min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-1.5 py-1 text-sm hover:border-gray-200 focus:border-gray-300 focus-visible:outline-none"
            />
            <button
              type="button"
              onClick={() => patch(s.id, { is_won: !s.is_won, is_lost: false })}
              className={cn("rounded px-1.5 py-0.5 text-[10px] font-semibold", s.is_won ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-400 hover:text-gray-600")}
            >
              Ganho
            </button>
            <button
              type="button"
              onClick={() => patch(s.id, { is_lost: !s.is_lost, is_won: false })}
              className={cn("rounded px-1.5 py-0.5 text-[10px] font-semibold", s.is_lost ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-400 hover:text-gray-600")}
            >
              Perdido
            </button>
            <button type="button" onClick={() => setToDelete(s)} className="text-gray-300 hover:text-red-500">
              <Trash2 size={14} />
            </button>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex items-center gap-2 border-t border-gray-100 pt-3">
        <GripVertical size={14} className="text-gray-200" />
        <ColorDot color={newColor} onChange={setNewColor} />
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addStage()}
          placeholder="Nova etapa…"
          className="min-w-0 flex-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40"
        />
        <button type="button" onClick={addStage} disabled={busy || !newName.trim()} className="rounded-lg bg-brand-500 p-1.5 text-white hover:bg-brand-600 disabled:opacity-50">
          <Plus size={16} />
        </button>
      </div>
      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
        title="Remover etapa?"
        description={`Os negócios em "${toDelete?.name}" serão movidos para a primeira etapa.`}
        confirmLabel="Remover"
        variant="danger"
        onConfirm={() => {
          if (toDelete) remove(toDelete);
          setToDelete(null);
        }}
      />
    </div>
  );
}

// ─── Tags ───
function TagsCard({ type, tags, onChanged }: { type: FunnelType; tags: Tag[]; onChanged: () => Promise<void> | void }) {
  const [name, setName] = useState("");
  const [color, setColor] = useState<string>(TAG_COLORS[0]);
  const [busy, setBusy] = useState(false);

  async function create() {
    if (!name.trim() || busy) return;
    setBusy(true);
    try {
      await api(`/api/funnel/tags`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, name: name.trim(), color }),
      });
      setName("");
      await onChanged();
    } catch (e) {
      toast({ title: "Erro", description: e instanceof Error ? e.message : "", variant: "error" });
    } finally {
      setBusy(false);
    }
  }

  async function remove(t: Tag) {
    await api(`/api/funnel/tags/${t.id}`, { method: "DELETE" });
    await onChanged();
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <h3 className="mb-3 text-sm font-semibold text-gray-900">Tags · {FUNNEL_TYPE_META[type].short}</h3>
      <div className="flex flex-wrap gap-1.5">
        {tags.length === 0 && <span className="text-xs text-gray-400">Nenhuma tag ainda.</span>}
        {tags.map((t) => (
          <span
            key={t.id}
            className="group inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium"
            style={{ borderColor: t.color, color: t.color, background: `${t.color}14` }}
          >
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: t.color }} />
            {t.name}
            <button type="button" onClick={() => remove(t)} className="opacity-40 hover:opacity-100">
              <Trash2 size={11} />
            </button>
          </span>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-2 border-t border-gray-100 pt-3">
        <ColorDot color={color} onChange={setColor} />
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && create()}
          placeholder="Nova tag…"
          className="min-w-0 flex-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40"
        />
        <button type="button" onClick={create} disabled={busy || !name.trim()} className="rounded-lg bg-brand-500 p-1.5 text-white hover:bg-brand-600 disabled:opacity-50">
          <Plus size={16} />
        </button>
      </div>
    </div>
  );
}
