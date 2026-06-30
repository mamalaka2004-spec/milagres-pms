"use client";

import { useCallback, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Loader2, Filter } from "lucide-react";
import type { ActivityLogItem } from "@/lib/db/queries/activity";
import { parseAction, entityLabel, VERB_LABELS, ENTITY_LABELS } from "@/lib/audit/labels";
import { getInitials } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";

const PAGE_SIZE = 40;

function summarize(details: ActivityLogItem["details"]): string | null {
  if (!details || typeof details !== "object" || Array.isArray(details)) return null;
  const d = details as Record<string, unknown>;
  // Prefer an explicit human label, then common name-ish fields.
  for (const key of ["label", "name", "full_name", "title", "booking_code", "code"]) {
    const v = d[key];
    if (typeof v === "string" && v.trim()) return v;
  }
  if (typeof d.from === "string" && typeof d.to === "string") return `${d.from} → ${d.to}`;
  return null;
}

export function ActivityLogList({
  initialLogs,
  entityTypes,
}: {
  initialLogs: ActivityLogItem[];
  entityTypes: string[];
}) {
  const [logs, setLogs] = useState<ActivityLogItem[]>(initialLogs);
  const [entityType, setEntityType] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(initialLogs.length < PAGE_SIZE);

  const fetchLogs = useCallback(
    async (opts: { reset: boolean; entityType: string }) => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ limit: String(PAGE_SIZE) });
        if (opts.entityType) params.set("entityType", opts.entityType);
        if (!opts.reset && logs.length > 0) {
          params.set("before", logs[logs.length - 1].created_at);
        }
        const res = await fetch(`/api/activity-logs?${params.toString()}`);
        const json = await res.json();
        const next: ActivityLogItem[] = json?.success ? json.data : [];
        setLogs((prev) => (opts.reset ? next : [...prev, ...next]));
        setDone(next.length < PAGE_SIZE);
      } catch {
        /* transient — leave list as-is */
      } finally {
        setLoading(false);
      }
    },
    [logs]
  );

  const onChangeFilter = (value: string) => {
    setEntityType(value);
    fetchLogs({ reset: true, entityType: value });
  };

  return (
    <div className="space-y-3">
      {/* Filter */}
      <div className="flex items-center gap-2">
        <Filter size={14} className="text-gray-400" aria-hidden="true" />
        <select
          value={entityType}
          onChange={(e) => onChangeFilter(e.target.value)}
          aria-label="Filtrar por tipo"
          className="rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-400/20"
        >
          <option value="">Todos os tipos</option>
          {entityTypes.map((t) => (
            <option key={t} value={t}>
              {ENTITY_LABELS[t]?.label ?? t}
            </option>
          ))}
        </select>
      </div>

      {/* List */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        {logs.length === 0 ? (
          <p className="px-4 py-12 text-center text-sm text-gray-400">Nenhuma atividade registrada ainda.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {logs.map((log) => {
              const { verb } = parseAction(log.action);
              const ent = entityLabel(log.entity_type);
              const verbInfo = VERB_LABELS[verb];
              const EntIcon = ent.icon;
              const summary = summarize(log.details);
              return (
                <li key={log.id} className="flex items-start gap-3 px-3 py-3 sm:px-4">
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-500/10 text-[11px] font-bold text-brand-700">
                    {log.user ? getInitials(log.user.full_name) : "—"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="text-sm font-semibold text-gray-900">
                        {log.user?.full_name ?? "Sistema"}
                      </span>
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium",
                          verbInfo.tone
                        )}
                      >
                        {verbInfo.label}
                      </span>
                      <span className="inline-flex items-center gap-1 text-sm text-gray-600">
                        <EntIcon size={13} className="text-gray-400" aria-hidden="true" />
                        {ent.label}
                      </span>
                      {summary && (
                        <span className="truncate text-sm text-gray-500">· {summary}</span>
                      )}
                    </div>
                    <div className="mt-0.5 text-xs text-gray-400">
                      {formatDistanceToNow(new Date(log.created_at), { addSuffix: true, locale: ptBR })}
                      {log.ip_address ? ` · ${log.ip_address}` : ""}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Load more */}
      {!done && logs.length > 0 && (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => fetchLogs({ reset: false, entityType })}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors duration-200 hover:bg-gray-50 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40"
          >
            {loading && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
            {loading ? "Carregando…" : "Carregar mais"}
          </button>
        </div>
      )}
    </div>
  );
}
