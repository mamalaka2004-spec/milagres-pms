"use client";

import { useMemo, useState } from "react";
import {
  Sparkles,
  Loader2,
  Check,
  X,
  AlertTriangle,
  ArrowRight,
  Building2,
  Pencil,
  Instagram,
  Home,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils/cn";
import { api } from "@/lib/chat/utils";
import { toast } from "@/components/ui/use-toast";

export interface NameSuggestion {
  id: string;
  current_name: string | null;
  phone: string | null;
  first_name: string | null;
  last_name: string | null;
  social_name: string | null;
  display_name: string | null;
  instagram_handle: string | null;
  unit_hint: string | null;
  suggested_tags: string[];
  is_company: boolean;
  confidence: "alta" | "media" | "baixa";
  source: "heuristic" | "ai";
  unusable: boolean;
  note?: string | null;
}

const CONF_META = {
  alta: { label: "Alta confiança", color: "#10b981", hint: "extração direta do texto — pode aplicar em lote" },
  media: { label: "Revisar", color: "#f59e0b", hint: "deduzido pela IA (ex.: a partir do @) — confira antes" },
  baixa: { label: "Baixa", color: "#ef4444", hint: "pouco material para decidir" },
} as const;

/**
 * Organizar nomes: analisa a agenda, mostra ANTES → DEPOIS agrupado por
 * confiança e aplica só o aprovado. Cada sugestão é editável na hora.
 */
export function NameCleanupDialog({
  open,
  onOpenChange,
  contactIds,
  onApplied,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  contactIds?: string[];
  onApplied: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [suggestions, setSuggestions] = useState<NameSuggestion[] | null>(null);
  const [accepted, setAccepted] = useState<Set<string>>(new Set());
  const [edits, setEdits] = useState<Record<string, { first: string; last: string }>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [stats, setStats] = useState<{ analyzed: number; ai_used: number } | null>(null);

  async function analyze() {
    setLoading(true);
    try {
      const res = await api<{ suggestions: NameSuggestion[]; analyzed: number; ai_used: number }>(
        `/api/contacts/ai-normalize`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(contactIds?.length ? { contact_ids: contactIds } : { limit: 60 }),
        }
      );
      // Só o que muda algo de fato.
      const changed = res.suggestions.filter(
        (s) =>
          s.unusable ||
          s.is_company ||
          (s.display_name ?? "") !== (s.current_name ?? "") ||
          (s.suggested_tags?.length ?? 0) > 0 ||
          !!s.unit_hint
      );
      setSuggestions(changed);
      // Pré-marca só as de alta confiança — as demais o operador confere.
      setAccepted(new Set(changed.filter((s) => !s.unusable && s.confidence === "alta").map((s) => s.id)));
      setEdits({});
      setStats({ analyzed: res.analyzed, ai_used: res.ai_used });
      if (changed.length === 0) {
        toast({ title: "Nada a corrigir", description: `${res.analyzed} contato(s) já estão ok`, variant: "success" });
      }
    } catch (e) {
      toast({ title: "Erro na análise", description: e instanceof Error ? e.message : "", variant: "error" });
    } finally {
      setLoading(false);
    }
  }

  function valueOf(s: NameSuggestion) {
    const e = edits[s.id];
    return { first: e?.first ?? s.first_name ?? "", last: e?.last ?? s.last_name ?? "" };
  }

  async function apply() {
    const list = suggestions ?? [];
    const names = list
      .filter((s) => accepted.has(s.id) && !s.unusable && !s.is_company)
      .map((s) => {
        const { first, last } = valueOf(s);
        return {
          id: s.id,
          first_name: first.trim() || null,
          last_name: last.trim() || null,
          social_name: s.social_name,
          display_name: [first.trim(), last.trim()].filter(Boolean).join(" ") || null,
        };
      })
      .filter((n) => !!n.first_name);
    // Recusados, empresas e sem-solução: fecham a revisão sem alterar o nome.
    const markOnly = list.filter((s) => !names.some((n) => n.id === s.id)).map((s) => s.id);
    if (names.length === 0 && markOnly.length === 0) return;

    setApplying(true);
    try {
      await api(`/api/contacts/bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contact_ids: [...names.map((n) => n.id), ...markOnly],
          action: "apply_names",
          names,
          mark_reviewed_ids: markOnly,
        }),
      });
      toast({
        title: "Agenda organizada",
        description: `${names.length} nome(s) corrigido(s)${markOnly.length ? ` · ${markOnly.length} marcado(s) como revisado(s)` : ""}`,
        variant: "success",
      });
      onApplied();
      onOpenChange(false);
      setSuggestions(null);
    } catch (e) {
      toast({ title: "Erro ao aplicar", description: e instanceof Error ? e.message : "", variant: "error" });
    } finally {
      setApplying(false);
    }
  }

  function toggle(id: string) {
    setAccepted((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const groups = useMemo(() => {
    const list = suggestions ?? [];
    return {
      alta: list.filter((s) => !s.unusable && !s.is_company && s.confidence === "alta"),
      revisar: list.filter((s) => !s.unusable && !s.is_company && s.confidence !== "alta"),
      empresas: list.filter((s) => s.is_company && !s.unusable),
      semNome: list.filter((s) => s.unusable),
    };
  }, [suggestions]);

  const aplicaveis = groups.alta.length + groups.revisar.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[96vw] sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles size={16} className="text-brand-600" /> Organizar nomes com IA
          </DialogTitle>
        </DialogHeader>
        <DialogBody className="space-y-3">
          {!suggestions ? (
            <div className="space-y-3 py-4 text-center">
              <p className="text-sm text-gray-600">
                A IA separa <b>Nome</b>, <b>Sobrenome</b> e <b>Nome social</b>, deduz o nome a partir
                do @ do Instagram, identifica perfis de <b>negócio</b> e reconhece marcadores
                (&quot;Cliente&quot;, &quot;Banida&quot;) e códigos de unidade.
              </p>
              <p className="text-xs text-gray-400">
                {contactIds?.length
                  ? `${contactIds.length} contato(s) selecionado(s).`
                  : "Serão analisados até 60 contatos ainda não revisados."}{" "}
                Nada é alterado sem sua aprovação.
              </p>
              <button
                onClick={analyze}
                disabled={loading}
                className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50"
              >
                {loading ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
                {loading ? "Analisando…" : "Analisar nomes"}
              </button>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500">
                <span>
                  {stats?.analyzed ?? 0} analisados · <b className="text-gray-800">{aplicaveis}</b> com
                  sugestão · {stats?.ai_used ?? 0} pela IA
                </span>
                {aplicaveis > 0 && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => setAccepted(new Set([...groups.alta, ...groups.revisar].map((s) => s.id)))}
                      className="font-medium text-brand-600 hover:underline"
                    >
                      marcar todos
                    </button>
                    <button onClick={() => setAccepted(new Set())} className="text-gray-500 hover:underline">
                      desmarcar
                    </button>
                  </div>
                )}
              </div>

              <div className="max-h-[52vh] space-y-3 overflow-y-auto scrollbar-thin pr-1">
                {(["alta", "revisar"] as const).map((key) => {
                  const list = groups[key];
                  if (list.length === 0) return null;
                  const meta = key === "alta" ? CONF_META.alta : CONF_META.media;
                  return (
                    <div key={key}>
                      <div className="mb-1.5 flex items-center gap-2">
                        <span
                          className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                          style={{ color: meta.color, background: `${meta.color}18` }}
                        >
                          {meta.label} · {list.length}
                        </span>
                        <span className="text-[10px] text-gray-400">{meta.hint}</span>
                      </div>
                      <div className="space-y-1.5">
                        {list.map((s) => {
                          const on = accepted.has(s.id);
                          const v = valueOf(s);
                          const editando = editingId === s.id;
                          return (
                            <div
                              key={s.id}
                              className={cn(
                                "rounded-lg border px-3 py-2",
                                on ? "border-brand-300 bg-brand-50/50" : "border-gray-200"
                              )}
                            >
                              <div className="flex items-center gap-3">
                                <button
                                  type="button"
                                  onClick={() => toggle(s.id)}
                                  className={cn(
                                    "flex h-5 w-5 shrink-0 items-center justify-center rounded border",
                                    on ? "border-brand-500 bg-brand-500 text-white" : "border-gray-300"
                                  )}
                                >
                                  {on && <Check size={13} />}
                                </button>
                                <div className="min-w-0 flex-1">
                                  {editando ? (
                                    <div className="flex flex-wrap gap-1.5">
                                      <input
                                        autoFocus
                                        value={v.first}
                                        onChange={(e) =>
                                          setEdits((p) => ({ ...p, [s.id]: { ...v, first: e.target.value } }))
                                        }
                                        placeholder="Nome"
                                        className="min-w-0 flex-1 basis-32 rounded border border-gray-200 px-2 py-1 text-sm"
                                      />
                                      <input
                                        value={v.last}
                                        onChange={(e) =>
                                          setEdits((p) => ({ ...p, [s.id]: { ...v, last: e.target.value } }))
                                        }
                                        placeholder="Sobrenome"
                                        className="min-w-0 flex-1 basis-32 rounded border border-gray-200 px-2 py-1 text-sm"
                                      />
                                      <button
                                        onClick={() => setEditingId(null)}
                                        className="rounded bg-brand-500 px-2 py-1 text-xs text-white"
                                      >
                                        ok
                                      </button>
                                    </div>
                                  ) : (
                                    <div className="flex flex-wrap items-center gap-2 text-sm">
                                      <span className="truncate text-gray-400 line-through">
                                        {s.current_name || "(sem nome)"}
                                      </span>
                                      <ArrowRight size={12} className="shrink-0 text-gray-300" />
                                      <span className="truncate font-medium text-gray-900">
                                        {[v.first, v.last].filter(Boolean).join(" ") || "—"}
                                      </span>
                                      {s.source === "ai" && (
                                        <span className="shrink-0 rounded-full bg-purple-50 px-1.5 py-0.5 text-[9px] font-semibold text-purple-600">
                                          IA
                                        </span>
                                      )}
                                    </div>
                                  )}
                                  <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-gray-400">
                                    <span>{s.phone}</span>
                                    {s.instagram_handle && (
                                      <span className="inline-flex items-center gap-0.5">
                                        <Instagram size={9} /> {s.instagram_handle}
                                      </span>
                                    )}
                                    {s.unit_hint && (
                                      <span className="inline-flex items-center gap-0.5 text-brand-700">
                                        <Home size={9} /> unidade {s.unit_hint}
                                      </span>
                                    )}
                                    {s.suggested_tags?.map((t) => (
                                      <span key={t} className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[9px]">
                                        {t}
                                      </span>
                                    ))}
                                    {s.note && <span className="italic">{s.note}</span>}
                                  </div>
                                </div>
                                {!editando && (
                                  <button
                                    onClick={() => setEditingId(s.id)}
                                    className="shrink-0 rounded p-1 text-gray-300 hover:text-gray-600"
                                    title="Corrigir manualmente"
                                  >
                                    <Pencil size={13} />
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}

                {groups.empresas.length > 0 && (
                  <div className="rounded-lg border border-blue-200 bg-blue-50/60 p-3">
                    <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-blue-800">
                      <Building2 size={12} /> {groups.empresas.length} perfil(is) de negócio — não recebem
                      saudação com nome
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {groups.empresas.map((s) => (
                        <span key={s.id} className="rounded-full bg-white px-2 py-0.5 text-[11px] text-blue-900">
                          {s.current_name || s.instagram_handle}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {groups.semNome.length > 0 && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-3">
                    <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-amber-800">
                      <AlertTriangle size={12} /> {groups.semNome.length} sem nome utilizável — serão marcados
                      como revisados
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {groups.semNome.map((s) => (
                        <span key={s.id} className="rounded-full bg-white px-2 py-0.5 text-[11px] text-amber-900">
                          {s.current_name || "(vazio)"} · {s.phone}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogBody>
        <DialogFooter>
          <button
            onClick={() => {
              onOpenChange(false);
              setSuggestions(null);
            }}
            className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
          >
            <X size={14} /> Fechar
          </button>
          {suggestions && suggestions.length > 0 && (
            <button
              onClick={apply}
              disabled={applying}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50"
            >
              {applying && <Loader2 size={15} className="animate-spin" />}
              Aplicar {accepted.size > 0 ? `${accepted.size}` : ""}
            </button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
