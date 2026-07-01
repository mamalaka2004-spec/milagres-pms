"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils/cn";
import { api } from "@/lib/chat/utils";
import { FUNNEL_TYPES, FUNNEL_TYPE_META, type FunnelType, type FunnelPipeline, type FunnelStage } from "@/types/funnel";

export function FunnelTargetSelect({
  defaultType = "vendas",
  onChange,
}: {
  defaultType?: FunnelType;
  onChange: (v: { type: FunnelType; pipelineId: string | null; stageId: string | null }) => void;
}) {
  const [type, setType] = useState<FunnelType>(defaultType);
  const [pipelines, setPipelines] = useState<FunnelPipeline[]>([]);
  const [pipelineId, setPipelineId] = useState<string | null>(null);
  const [stages, setStages] = useState<FunnelStage[]>([]);
  const [stageId, setStageId] = useState<string | null>(null);

  const loadPipelines = useCallback(async () => {
    const list = await api<FunnelPipeline[]>(`/api/funnel/pipelines?type=${type}`).catch(() => []);
    setPipelines(list);
    const pid = list.find((p) => p.is_default)?.id ?? list[0]?.id ?? null;
    setPipelineId(pid);
  }, [type]);

  useEffect(() => {
    loadPipelines();
  }, [loadPipelines]);

  useEffect(() => {
    if (!pipelineId) return setStages([]);
    api<FunnelStage[]>(`/api/funnel/stages?pipeline_id=${pipelineId}`)
      .then((s) => {
        setStages(s);
        setStageId(s[0]?.id ?? null);
      })
      .catch(() => setStages([]));
  }, [pipelineId]);

  // Ref evita loop: só reporta quando a SELEÇÃO muda, não quando o callback muda de identidade.
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  useEffect(() => {
    onChangeRef.current({ type, pipelineId, stageId });
  }, [type, pipelineId, stageId]);

  return (
    <div className="space-y-2">
      <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-1">
        {FUNNEL_TYPES.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setType(t)}
            className={cn(
              "rounded-md px-3 py-1 text-xs font-medium transition-colors",
              type === t ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
            )}
          >
            {FUNNEL_TYPE_META[t].short}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <select
          value={pipelineId ?? ""}
          onChange={(e) => setPipelineId(e.target.value || null)}
          className="rounded-lg border border-gray-200 bg-white px-2.5 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40"
        >
          {pipelines.length === 0 && <option value="">Sem funil</option>}
          {pipelines.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <select
          value={stageId ?? ""}
          onChange={(e) => setStageId(e.target.value || null)}
          className="rounded-lg border border-gray-200 bg-white px-2.5 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40"
        >
          {stages.length === 0 && <option value="">Sem etapa</option>}
          {stages.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
