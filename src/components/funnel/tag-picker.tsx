"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Tag as TagIcon, Plus, Check, X } from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui";
import { cn } from "@/lib/utils/cn";
import { api } from "@/lib/chat/utils";
import { TAG_COLORS, type FunnelType, type Tag } from "@/types/funnel";

/** Chips somente-leitura (usado no card do kanban e no cabeçalho da conversa). */
export function TagChips({ tags, size = "default" }: { tags: Tag[]; size?: "default" | "sm" }) {
  if (!tags?.length) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {tags.map((t) => (
        <span
          key={t.id}
          className={cn(
            "inline-flex items-center gap-1 rounded-full border font-medium",
            size === "sm" ? "text-[10px] px-1.5 py-0" : "text-[11px] px-2 py-0.5"
          )}
          style={{ borderColor: t.color, color: t.color, background: `${t.color}14` }}
        >
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: t.color }} />
          {t.name}
        </span>
      ))}
    </div>
  );
}

export function TagPicker({
  type,
  value,
  onChange,
  className,
  triggerLabel = "Tags",
}: {
  type: FunnelType;
  value: string[];
  onChange: (ids: string[]) => void;
  className?: string;
  triggerLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [tags, setTags] = useState<Tag[]>([]);
  const [query, setQuery] = useState("");
  const [color, setColor] = useState<string>(TAG_COLORS[0]);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    try {
      setTags(await api<Tag[]>(`/api/funnel/tags?type=${type}`));
    } catch {
      /* degrade */
    }
  }, [type]);

  useEffect(() => {
    if (open && tags.length === 0) load();
  }, [open, tags.length, load]);

  const selected = useMemo(() => tags.filter((t) => value.includes(t.id)), [tags, value]);
  const lower = query.trim().toLowerCase();
  const filtered = useMemo(
    () => (lower ? tags.filter((t) => t.name.toLowerCase().includes(lower)) : tags),
    [tags, lower]
  );
  const exact = tags.some((t) => t.name.toLowerCase() === lower);

  function toggle(id: string) {
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);
  }

  async function handleCreate() {
    if (!lower || creating) return;
    setCreating(true);
    try {
      const tag = await api<Tag>(`/api/funnel/tags`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, name: query.trim(), color }),
      });
      setTags((prev) => (prev.some((t) => t.id === tag.id) ? prev : [...prev, tag]));
      if (!value.includes(tag.id)) onChange([...value, tag.id]);
      setQuery("");
    } catch {
      /* ignore */
    } finally {
      setCreating(false);
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "min-h-9 w-full rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-left text-sm hover:border-gray-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40",
            className
          )}
        >
          {selected.length === 0 ? (
            <span className="inline-flex items-center gap-2 text-gray-400">
              <TagIcon size={14} /> {triggerLabel}
            </span>
          ) : (
            <span className="flex flex-wrap items-center gap-1">
              {selected.map((t) => (
                <span
                  key={t.id}
                  className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium"
                  style={{ borderColor: t.color, color: t.color, background: `${t.color}14` }}
                >
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: t.color }} />
                  {t.name}
                  <X
                    size={11}
                    className="cursor-pointer opacity-60 hover:opacity-100"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggle(t.id);
                    }}
                  />
                </span>
              ))}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-0">
        <div className="border-b border-gray-100 p-2">
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar ou criar tag…"
            className="w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40"
          />
        </div>
        <ul className="max-h-56 overflow-y-auto scrollbar-thin p-1">
          {filtered.length === 0 && !lower && (
            <li className="px-2 py-4 text-center text-xs text-gray-400">Nenhuma tag ainda.</li>
          )}
          {filtered.map((t) => {
            const sel = value.includes(t.id);
            return (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => toggle(t.id)}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-gray-50"
                >
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: t.color }} />
                  <span className="flex-1 text-left truncate">{t.name}</span>
                  {sel && <Check size={15} className="text-brand-500" />}
                </button>
              </li>
            );
          })}
        </ul>
        {lower && !exact && (
          <div className="space-y-2 border-t border-gray-100 p-2">
            <div className="flex items-center gap-1.5">
              {TAG_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={cn("h-5 w-5 rounded-full border-2", color === c ? "border-gray-800" : "border-transparent")}
                  style={{ background: c }}
                  aria-label={`Cor ${c}`}
                />
              ))}
            </div>
            <button
              type="button"
              onClick={handleCreate}
              disabled={creating}
              className="flex w-full items-center justify-center gap-1 rounded-lg bg-brand-500 px-2 py-1.5 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-60"
            >
              <Plus size={14} /> Criar “{query.trim()}”
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
