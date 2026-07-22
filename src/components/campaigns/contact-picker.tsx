"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Search, Loader2, Check, X, UserPlus, Users, Plus } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { api } from "@/lib/chat/utils";
import { toast } from "@/components/ui/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
} from "@/components/ui/dialog";
import { CONTACT_CATEGORY_LABELS, type ContactLite } from "@/types/campaign";

/**
 * Seletor multi de contatos do fonebook (cross-base) — abre um dialog amplo
 * com busca, filtros por categoria/tag e criação rápida de contato.
 * `value` = contatos escolhidos. Mesmo contrato da versão antiga.
 */
export function ContactPicker({
  value,
  onChange,
}: {
  value: ContactLite[];
  onChange: (contacts: ContactLite[]) => void;
  /** @deprecated mantido por compat — o dialog tem altura própria. */
  listHeight?: string;
}) {
  const [open, setOpen] = useState(false);

  function removeOne(c: ContactLite) {
    onChange(value.filter((v) => v.id !== c.id));
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:border-brand-400 hover:text-brand-700"
        >
          <Users size={15} /> Selecionar contatos
          {value.length > 0 && (
            <span className="rounded-full bg-brand-500 px-1.5 py-0.5 text-[10px] font-semibold text-white">
              {value.length}
            </span>
          )}
        </button>
        {value.length > 0 && (
          <button type="button" onClick={() => onChange([])} className="text-xs text-red-500 hover:underline">
            limpar seleção
          </button>
        )}
      </div>

      {value.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {value.slice(0, 30).map((c) => (
            <span key={c.id} className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-700">
              {c.display_name || c.phone_e164}
              <X size={11} className="cursor-pointer opacity-50 hover:opacity-100" onClick={() => removeOne(c)} />
            </span>
          ))}
          {value.length > 30 && <span className="px-1 text-[11px] text-gray-400">+{value.length - 30}</span>}
        </div>
      )}

      <PickerDialog open={open} onOpenChange={setOpen} value={value} onChange={onChange} />
    </div>
  );
}

function PickerDialog({
  open,
  onOpenChange,
  value,
  onChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  value: ContactLite[];
  onChange: (contacts: ContactLite[]) => void;
}) {
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [tag, setTag] = useState("");
  const [allTags, setAllTags] = useState<string[]>([]);
  const [results, setResults] = useState<ContactLite[]>([]);
  const [loading, setLoading] = useState(false);

  // Criação rápida
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [savingNew, setSavingNew] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "200" });
      if (q.trim()) params.set("q", q.trim());
      if (category) params.set("category", category);
      if (tag) params.set("tag", tag);
      setResults(await api<ContactLite[]>(`/api/contacts?${params}`));
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [q, category, tag]);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load, open]);

  useEffect(() => {
    if (open) api<string[]>(`/api/contacts/tags`).then(setAllTags).catch(() => setAllTags([]));
  }, [open]);

  const selectedIds = useMemo(() => new Set(value.map((v) => v.id)), [value]);

  function toggle(c: ContactLite) {
    onChange(selectedIds.has(c.id) ? value.filter((v) => v.id !== c.id) : [...value, c]);
  }
  function addAll() {
    const byId = new Map(value.map((v) => [v.id, v]));
    for (const c of results) if (!c.do_not_contact) byId.set(c.id, c);
    onChange([...byId.values()]);
  }

  async function createQuick() {
    if (!newName.trim() || !newPhone.trim() || savingNew) return;
    setSavingNew(true);
    try {
      const contact = await api<ContactLite>(`/api/contacts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ display_name: newName.trim(), phone: newPhone.trim(), category: "lead" }),
      });
      onChange([...value, contact]);
      setNewName("");
      setNewPhone("");
      setCreating(false);
      load();
      toast({ title: "Contato criado e selecionado", variant: "success" });
    } catch (e) {
      toast({ title: "Erro", description: e instanceof Error ? e.message : "", variant: "error" });
    } finally {
      setSavingNew(false);
    }
  }

  const selectClass =
    "rounded-lg border border-gray-200 bg-white px-2.5 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Selecionar contatos</DialogTitle>
        </DialogHeader>
        <DialogBody className="space-y-3">
          {/* Filtros */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-0 flex-1 basis-52">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar por nome ou telefone…"
                autoFocus
                className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2 pl-9 pr-3 text-sm focus:border-brand-500 focus:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40"
              />
            </div>
            <select value={category} onChange={(e) => setCategory(e.target.value)} className={selectClass}>
              <option value="">Todas categorias</option>
              {Object.entries(CONTACT_CATEGORY_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
            <select value={tag} onChange={(e) => setTag(e.target.value)} className={selectClass}>
              <option value="">Todas tags</option>
              {allTags.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          {/* Criação rápida */}
          {creating ? (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-brand-200 bg-brand-50/40 p-2">
              <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nome" className="min-w-0 flex-1 basis-40 rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40" />
              <input value={newPhone} onChange={(e) => setNewPhone(e.target.value)} placeholder="+55 82 99999-9999" className="min-w-0 flex-1 basis-40 rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40" />
              <button onClick={createQuick} disabled={savingNew || !newName.trim() || !newPhone.trim()} className="inline-flex items-center gap-1 rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-600 disabled:opacity-50">
                {savingNew && <Loader2 size={12} className="animate-spin" />} Criar
              </button>
              <button onClick={() => setCreating(false)} className="rounded-lg px-2 py-1.5 text-xs text-gray-500 hover:bg-gray-100">
                Cancelar
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span>
                <b className="text-gray-800">{value.length}</b> selecionado(s)
              </span>
              <div className="flex items-center gap-3">
                <button onClick={() => setCreating(true)} className="inline-flex items-center gap-1 font-medium text-brand-600 hover:underline">
                  <Plus size={12} /> Novo contato
                </button>
                {results.length > 0 && (
                  <button onClick={addAll} className="inline-flex items-center gap-1 font-medium text-brand-600 hover:underline">
                    <UserPlus size={12} /> Selecionar os {results.length}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Resultados */}
          <div className="h-[46vh] overflow-y-auto rounded-xl border border-gray-200 scrollbar-thin">
            {loading ? (
              <div className="flex h-full items-center justify-center text-gray-400">
                <Loader2 className="animate-spin" size={18} />
              </div>
            ) : results.length === 0 ? (
              <div className="flex h-full items-center justify-center px-4 text-center text-xs text-gray-400">
                Nenhum contato encontrado. Use &quot;Novo contato&quot; para cadastrar.
              </div>
            ) : (
              <ul className="divide-y divide-gray-50">
                {results.map((c) => {
                  const sel = selectedIds.has(c.id);
                  return (
                    <li key={c.id}>
                      <button
                        type="button"
                        onClick={() => toggle(c)}
                        className={cn("flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-gray-50", sel && "bg-brand-50/60")}
                      >
                        <span className={cn("flex h-5 w-5 shrink-0 items-center justify-center rounded border", sel ? "border-brand-500 bg-brand-500 text-white" : "border-gray-300")}>
                          {sel && <Check size={13} />}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="truncate text-sm font-medium text-gray-900">
                              {c.display_name || c.phone_e164 || c.phone_canonical}
                            </span>
                            {c.do_not_contact && (
                              <span className="shrink-0 rounded-full bg-red-50 px-1.5 py-0.5 text-[9px] font-semibold text-red-500">
                                Não contatar
                              </span>
                            )}
                          </div>
                          <div className="truncate text-[11px] text-gray-400">
                            {c.phone_e164 || c.phone_canonical}
                            {c.category && ` · ${CONTACT_CATEGORY_LABELS[c.category] ?? c.category}`}
                            {(c.tags?.length ?? 0) > 0 && ` · ${c.tags!.slice(0, 3).join(", ")}`}
                          </div>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </DialogBody>
        <DialogFooter>
          <button onClick={() => onOpenChange(false)} className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600">
            Concluir {value.length > 0 ? `(${value.length})` : ""}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
