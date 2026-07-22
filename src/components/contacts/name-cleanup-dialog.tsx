"use client";

import { useState } from "react";
import { Sparkles, Loader2, Check, X, AlertTriangle, ArrowRight } from "lucide-react";
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
  source: "heuristic" | "ai";
  unusable: boolean;
  note?: string | null;
}

/**
 * Organizar nomes com IA: analisa a agenda, mostra ANTES → DEPOIS e aplica só
 * o que for aprovado. Nada é gravado sem revisão.
 */
export function NameCleanupDialog({
  open,
  onOpenChange,
  contactIds,
  onApplied,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  /** Vazio = pega a fila de não revisados. */
  contactIds?: string[];
  onApplied: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [suggestions, setSuggestions] = useState<NameSuggestion[] | null>(null);
  const [accepted, setAccepted] = useState<Set<string>>(new Set());
  const [stats, setStats] = useState<{ analyzed: number; ai_used: number } | null>(null);

  async function analyze() {
    setLoading(true);
    try {
      const res = await api<{ suggestions: NameSuggestion[]; analyzed: number; ai_used: number }>(
        `/api/contacts/ai-normalize`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(contactIds?.length ? { contact_ids: contactIds } : { limit: 40 }),
        }
      );
      // Só interessa o que realmente muda algo.
      const changed = res.suggestions.filter(
        (s) => s.unusable || (s.display_name ?? "") !== (s.current_name ?? "")
      );
      setSuggestions(changed);
      setAccepted(new Set(changed.filter((s) => !s.unusable).map((s) => s.id)));
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

  async function apply() {
    const names = (suggestions ?? [])
      .filter((s) => accepted.has(s.id) && !s.unusable)
      .map((s) => ({
        id: s.id,
        first_name: s.first_name,
        last_name: s.last_name,
        social_name: s.social_name,
        display_name: s.display_name,
      }));
    // Sem nome utilizável ou sugestão recusada: marca como revisado para não
    // voltar na fila toda vez (fica editável manualmente na lista).
    const markOnly = (suggestions ?? [])
      .filter((s) => !accepted.has(s.id) || s.unusable)
      .map((s) => s.id);
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
        title: "Nomes atualizados",
        description: `${names.length} corrigido(s)${markOnly.length ? ` · ${markOnly.length} marcado(s) como revisado(s)` : ""}`,
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

  const usable = (suggestions ?? []).filter((s) => !s.unusable);
  const unusable = (suggestions ?? []).filter((s) => s.unusable);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles size={16} className="text-brand-600" /> Organizar nomes com IA
          </DialogTitle>
        </DialogHeader>
        <DialogBody className="space-y-3">
          {!suggestions ? (
            <div className="space-y-3 py-4 text-center">
              <p className="text-sm text-gray-600">
                A IA analisa os nomes bagunçados da agenda — handles do Instagram, emojis, tudo
                em maiúsculas, marcadores como &quot;Lead&quot; — e sugere Nome, Sobrenome e Nome
                social separados.
              </p>
              <p className="text-xs text-gray-400">
                {contactIds?.length
                  ? `${contactIds.length} contato(s) selecionado(s).`
                  : "Serão analisados até 40 contatos ainda não revisados."}{" "}
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
                  {stats?.analyzed ?? 0} analisados · <b className="text-gray-800">{usable.length}</b> com
                  sugestão · {stats?.ai_used ?? 0} pela IA
                </span>
                {usable.length > 0 && (
                  <div className="flex gap-2">
                    <button onClick={() => setAccepted(new Set(usable.map((s) => s.id)))} className="font-medium text-brand-600 hover:underline">
                      marcar todos
                    </button>
                    <button onClick={() => setAccepted(new Set())} className="text-gray-500 hover:underline">
                      desmarcar
                    </button>
                  </div>
                )}
              </div>

              <div className="max-h-[46vh] space-y-1.5 overflow-y-auto scrollbar-thin">
                {usable.map((s) => {
                  const on = accepted.has(s.id);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => toggle(s.id)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left",
                        on ? "border-brand-300 bg-brand-50/50" : "border-gray-200 hover:bg-gray-50"
                      )}
                    >
                      <span className={cn("flex h-5 w-5 shrink-0 items-center justify-center rounded border", on ? "border-brand-500 bg-brand-500 text-white" : "border-gray-300")}>
                        {on && <Check size={13} />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2 text-sm">
                          <span className="truncate text-gray-400 line-through">{s.current_name || "(sem nome)"}</span>
                          <ArrowRight size={12} className="shrink-0 text-gray-300" />
                          <span className="truncate font-medium text-gray-900">{s.display_name}</span>
                          {s.source === "ai" && (
                            <span className="shrink-0 rounded-full bg-purple-50 px-1.5 py-0.5 text-[9px] font-semibold text-purple-600">
                              IA
                            </span>
                          )}
                        </div>
                        <div className="truncate text-[11px] text-gray-400">
                          {s.phone}
                          {s.first_name && ` · nome: ${s.first_name}`}
                          {s.last_name && ` · sobrenome: ${s.last_name}`}
                          {s.social_name && ` · social: ${s.social_name}`}
                          {s.note && ` · ${s.note}`}
                        </div>
                      </div>
                    </button>
                  );
                })}

                {unusable.length > 0 && (
                  <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50/60 p-3">
                    <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-amber-800">
                      <AlertTriangle size={12} /> {unusable.length} sem nome utilizável — edite manualmente
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {unusable.map((s) => (
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
