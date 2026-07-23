"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Search, Loader2, Check, X, UserPlus, Users, Plus, ChevronLeft, ChevronRight, Instagram } from "lucide-react";
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

const PICKER_PAGE = 50;

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
  const [minRating, setMinRating] = useState(0);
  const [nameStatus, setNameStatus] = useState("");
  const [hideDnc, setHideDnc] = useState(true);
  const [allTags, setAllTags] = useState<string[]>([]);
  const [results, setResults] = useState<ContactLite[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);

  // Criação rápida
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [savingNew, setSavingNew] = useState(false);

  const filterParams = useCallback(() => {
    const p = new URLSearchParams();
    if (q.trim()) p.set("q", q.trim());
    if (category) p.set("category", category);
    if (tag) p.set("tag", tag);
    if (minRating) p.set("min_rating", String(minRating));
    if (nameStatus) p.set("name_status", nameStatus);
    if (hideDnc) p.set("dnc", "0");
    return p;
  }, [q, category, tag, minRating, nameStatus, hideDnc]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = filterParams();
      params.set("paged", "1");
      params.set("limit", String(PICKER_PAGE));
      params.set("offset", String(page * PICKER_PAGE));
      const res = await api<{ contacts: ContactLite[]; total: number }>(`/api/contacts?${params}`);
      setResults(res.contacts);
      setTotal(res.total);
    } catch {
      setResults([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [filterParams, page]);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load, open]);

  useEffect(() => {
    setPage(0);
  }, [q, category, tag, minRating, nameStatus, hideDnc]);

  useEffect(() => {
    if (open) api<string[]>(`/api/contacts/tags`).then(setAllTags).catch(() => setAllTags([]));
  }, [open]);

  const selectedIds = useMemo(() => new Set(value.map((v) => v.id)), [value]);
  const totalPages = Math.max(1, Math.ceil(total / PICKER_PAGE));

  function toggle(c: ContactLite) {
    onChange(selectedIds.has(c.id) ? value.filter((v) => v.id !== c.id) : [...value, c]);
  }
  function addPage() {
    const byId = new Map(value.map((v) => [v.id, v]));
    for (const c of results) if (!c.do_not_contact) byId.set(c.id, c);
    onChange([...byId.values()]);
  }
  /** Seleciona TODOS os contatos do filtro (além da página) — busca leve só de dados. */
  async function addAllMatching() {
    try {
      const params = filterParams();
      params.set("paged", "1");
      params.set("limit", "5000");
      const res = await api<{ contacts: ContactLite[] }>(`/api/contacts?${params}`);
      const byId = new Map(value.map((v) => [v.id, v]));
      for (const c of res.contacts) if (!c.do_not_contact) byId.set(c.id, c);
      onChange([...byId.values()]);
      toast({ title: `${res.contacts.length} do filtro selecionados`, variant: "success" });
    } catch (e) {
      toast({ title: "Erro", description: e instanceof Error ? e.message : "", variant: "error" });
    }
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
      <DialogContent className="w-[96vw] max-w-5xl">
        <DialogHeader>
          <DialogTitle>Selecionar contatos</DialogTitle>
        </DialogHeader>
        <DialogBody className="space-y-3">
          {/* Filtros */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-0 flex-1 basis-56">
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
            <select value={minRating} onChange={(e) => setMinRating(Number(e.target.value))} className={selectClass}>
              <option value={0}>Qualquer rating</option>
              {[5, 4, 3, 2, 1].map((n) => (
                <option key={n} value={n}>{"★".repeat(n)}+</option>
              ))}
            </select>
            <select value={nameStatus} onChange={(e) => setNameStatus(e.target.value)} className={selectClass}>
              <option value="">Qualquer nome</option>
              <option value="ok">Nome tratado</option>
              <option value="sem_nome">Sem primeiro nome</option>
            </select>
            <label className="flex items-center gap-1.5 text-xs text-gray-600">
              <input type="checkbox" checked={hideDnc} onChange={(e) => setHideDnc(e.target.checked)} className="accent-brand-500" />
              ocultar não-contatar
            </label>
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
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500">
              <span>
                <b className="text-gray-800">{value.length}</b> selecionado(s) · {total} no filtro
              </span>
              <div className="flex items-center gap-3">
                <button onClick={() => setCreating(true)} className="inline-flex items-center gap-1 font-medium text-brand-600 hover:underline">
                  <Plus size={12} /> Novo contato
                </button>
                {results.length > 0 && (
                  <button onClick={addPage} className="inline-flex items-center gap-1 font-medium text-brand-600 hover:underline">
                    <UserPlus size={12} /> Selecionar a página
                  </button>
                )}
                {total > results.length && (
                  <button onClick={addAllMatching} className="inline-flex items-center gap-1 font-medium text-brand-600 hover:underline">
                    <UserPlus size={12} /> Selecionar todos os {total}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Resultados — grade responsiva (1 col no mobile, 2 no tablet, 3 no desktop) */}
          <div className="h-[52vh] overflow-y-auto rounded-xl border border-gray-200 scrollbar-thin p-1.5 sm:h-[56vh]">
            {loading ? (
              <div className="flex h-full items-center justify-center text-gray-400">
                <Loader2 className="animate-spin" size={18} />
              </div>
            ) : results.length === 0 ? (
              <div className="flex h-full items-center justify-center px-4 text-center text-xs text-gray-400">
                Nenhum contato encontrado. Use &quot;Novo contato&quot; para cadastrar.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 xl:grid-cols-3">
                {results.map((c) => {
                  const sel = selectedIds.has(c.id);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => toggle(c)}
                      className={cn(
                        "flex items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition-colors",
                        sel ? "border-brand-300 bg-brand-50/60" : "border-gray-100 hover:border-gray-200 hover:bg-gray-50"
                      )}
                    >
                      <span className={cn("flex h-5 w-5 shrink-0 items-center justify-center rounded border", sel ? "border-brand-500 bg-brand-500 text-white" : "border-gray-300")}>
                        {sel && <Check size={13} />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="truncate text-sm font-medium text-gray-900">
                            {c.first_name
                              ? [c.first_name, c.last_name].filter(Boolean).join(" ")
                              : c.display_name || c.phone_e164 || c.phone_canonical}
                          </span>
                          {c.instagram_handle && (
                            <span className="inline-flex shrink-0 items-center gap-0.5 text-[10px] text-pink-500">
                              <Instagram size={9} /> {c.instagram_handle}
                            </span>
                          )}
                          {c.do_not_contact && (
                            <span className="shrink-0 rounded-full bg-red-50 px-1.5 py-0.5 text-[9px] font-semibold text-red-500">
                              Não contatar
                            </span>
                          )}
                        </div>
                        <div className="truncate text-[11px] text-gray-400">
                          {c.phone_e164 || c.phone_canonical}
                          {c.category && ` · ${CONTACT_CATEGORY_LABELS[c.category] ?? c.category}`}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Paginação */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 text-xs text-gray-500">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="rounded-lg border border-gray-200 p-1.5 hover:bg-gray-50 disabled:opacity-40"
              >
                <ChevronLeft size={14} />
              </button>
              <span>
                página <b className="text-gray-700">{page + 1}</b> de {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="rounded-lg border border-gray-200 p-1.5 hover:bg-gray-50 disabled:opacity-40"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          )}
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
