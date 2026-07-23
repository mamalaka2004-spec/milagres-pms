"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Tag as TagIcon, Pencil, Trash2, Check, X, Search, Filter } from "lucide-react";
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
import { ConfirmDialog } from "@/components/ui";

interface TagCount {
  tag: string;
  count: number;
}

/** Gerenciador de etiquetas de contato: ver com contagem, renomear e excluir em lote. */
export function TagManagerDialog({
  open,
  onOpenChange,
  onChanged,
  onFilterTag,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  /** Chamado após renomear/excluir (para a lista recarregar). */
  onChanged: () => void;
  /** Filtrar a lista de contatos por uma etiqueta (fecha o gerenciador). */
  onFilterTag?: (tag: string) => void;
}) {
  const [rows, setRows] = useState<TagCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<TagCount | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await api<TagCount[]>(`/api/contacts/tags?counts=1`));
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  async function rename(tag: string) {
    const to = draft.trim().toLowerCase();
    if (!to || to === tag) {
      setEditing(null);
      return;
    }
    setBusy(tag);
    try {
      const res = await api<{ affected: number }>(`/api/contacts/tags`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "rename", tag, to }),
      });
      toast({ title: "Etiqueta renomeada", description: `${res.affected} contato(s)`, variant: "success" });
      setEditing(null);
      await load();
      onChanged();
    } catch (e) {
      toast({ title: "Erro", description: e instanceof Error ? e.message : "", variant: "error" });
    } finally {
      setBusy(null);
    }
  }

  async function remove(tag: string) {
    setBusy(tag);
    try {
      const res = await api<{ affected: number }>(`/api/contacts/tags`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", tag }),
      });
      toast({ title: "Etiqueta excluída", description: `removida de ${res.affected} contato(s)`, variant: "success" });
      await load();
      onChanged();
    } catch (e) {
      toast({ title: "Erro", description: e instanceof Error ? e.message : "", variant: "error" });
    } finally {
      setBusy(null);
    }
  }

  const filtered = q.trim()
    ? rows.filter((r) => r.tag.toLowerCase().includes(q.trim().toLowerCase()))
    : rows;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[96vw] sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TagIcon size={16} className="text-brand-600" /> Gerenciar etiquetas
          </DialogTitle>
        </DialogHeader>
        <DialogBody className="space-y-3">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar etiqueta…"
              className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2 pl-9 pr-3 text-sm focus:border-brand-500 focus:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40"
            />
          </div>

          <div className="max-h-[52vh] overflow-y-auto rounded-xl border border-gray-200 scrollbar-thin">
            {loading ? (
              <div className="flex justify-center py-12 text-gray-400">
                <Loader2 className="animate-spin" size={18} />
              </div>
            ) : filtered.length === 0 ? (
              <p className="py-10 text-center text-xs text-gray-400">
                {rows.length === 0 ? "Nenhuma etiqueta em uso ainda." : "Nada encontrado."}
              </p>
            ) : (
              <ul className="divide-y divide-gray-50">
                {filtered.map((r) => {
                  const isEditing = editing === r.tag;
                  const isBusy = busy === r.tag;
                  return (
                    <li key={r.tag} className="flex items-center gap-2 px-3 py-2">
                      {isEditing ? (
                        <>
                          <input
                            autoFocus
                            value={draft}
                            onChange={(e) => setDraft(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") rename(r.tag);
                              if (e.key === "Escape") setEditing(null);
                            }}
                            className="min-w-0 flex-1 rounded border border-gray-200 px-2 py-1 text-sm"
                          />
                          <button onClick={() => rename(r.tag)} disabled={isBusy} className="rounded bg-brand-500 p-1.5 text-white disabled:opacity-50">
                            {isBusy ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                          </button>
                          <button onClick={() => setEditing(null)} className="rounded p-1.5 text-gray-400 hover:text-gray-600">
                            <X size={14} />
                          </button>
                        </>
                      ) : (
                        <>
                          <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700">
                            <TagIcon size={11} /> {r.tag}
                          </span>
                          <span className="text-xs text-gray-400">{r.count} contato(s)</span>
                          <div className="ml-auto flex items-center gap-0.5">
                            {onFilterTag && (
                              <button
                                onClick={() => {
                                  onFilterTag(r.tag);
                                  onOpenChange(false);
                                }}
                                className="rounded-lg p-1.5 text-gray-300 hover:text-brand-600"
                                title="Ver contatos com esta etiqueta"
                              >
                                <Filter size={14} />
                              </button>
                            )}
                            <button
                              onClick={() => {
                                setEditing(r.tag);
                                setDraft(r.tag);
                              }}
                              className="rounded-lg p-1.5 text-gray-300 hover:text-gray-600"
                              title="Renomear"
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              onClick={() => setDeleting(r)}
                              disabled={isBusy}
                              className="rounded-lg p-1.5 text-gray-300 hover:text-red-500 disabled:opacity-50"
                              title="Excluir etiqueta de todos"
                            >
                              {isBusy ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                            </button>
                          </div>
                        </>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          <p className="text-[11px] text-gray-400">
            Renomear mescla com a etiqueta de destino se ela já existir. Excluir remove a etiqueta de
            todos os contatos (não apaga os contatos).
          </p>
        </DialogBody>
        <DialogFooter>
          <button onClick={() => onOpenChange(false)} className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600">
            Concluir
          </button>
        </DialogFooter>
      </DialogContent>

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={`Excluir a etiqueta "${deleting?.tag}"?`}
        description={`Será removida de ${deleting?.count ?? 0} contato(s). Os contatos permanecem.`}
        confirmLabel="Excluir etiqueta"
        variant="danger"
        onConfirm={() => {
          if (deleting) remove(deleting.tag);
          setDeleting(null);
        }}
      />
    </Dialog>
  );
}
