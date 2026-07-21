"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Plus,
  Loader2,
  Trash2,
  Pencil,
  ChevronDown,
  ChevronRight,
  UserMinus,
  Ban,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { api } from "@/lib/chat/utils";
import { toast } from "@/components/ui/use-toast";
import { ConfirmDialog } from "@/components/ui";
import { ContactPicker } from "./contact-picker";
import { CONTACT_CATEGORY_LABELS, type ContactList, type ContactLite } from "@/types/campaign";

/** Aba Listas — listas salvas do fonebook, usadas como audiência de campanhas. */
export function ContactListsTab() {
  const [lists, setLists] = useState<ContactList[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    try {
      setLists(await api<ContactList[]>(`/api/contact-lists`));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex justify-center py-16 text-gray-400">
        <Loader2 className="animate-spin" size={20} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {!creating && (
        <button
          onClick={() => setCreating(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-3 py-2 text-sm font-medium text-white hover:bg-brand-600"
        >
          <Plus size={16} /> Nova lista
        </button>
      )}
      {creating && (
        <ListForm
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false);
            load();
          }}
        />
      )}
      {lists.length === 0 && !creating ? (
        <div className="rounded-xl border border-dashed border-gray-200 py-12 text-center text-sm text-gray-400">
          Nenhuma lista ainda. Crie listas de contatos para usar como audiência das campanhas.
        </div>
      ) : (
        <ul className="space-y-2">
          {lists.map((l) => (
            <ListRow key={l.id} list={l} onChanged={load} />
          ))}
        </ul>
      )}
    </div>
  );
}

function ListForm({
  list,
  onClose,
  onSaved,
}: {
  list?: ContactList;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(list?.name ?? "");
  const [description, setDescription] = useState(list?.description ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!name.trim() || saving) return;
    setSaving(true);
    try {
      const body = JSON.stringify({ name: name.trim(), description: description.trim() || null });
      if (list) {
        await api(`/api/contact-lists/${list.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body,
        });
        toast({ title: "Lista atualizada", variant: "success" });
      } else {
        await api(`/api/contact-lists`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
        });
        toast({ title: "Lista criada", variant: "success" });
      }
      onSaved();
    } catch (e) {
      toast({ title: "Erro", description: e instanceof Error ? e.message : "", variant: "error" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3 rounded-xl border border-gray-200 bg-white p-4">
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Nome da lista</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex.: Leads de vendas — julho"
            className="w-full rounded-lg border border-gray-200 px-2.5 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Descrição (opcional)</label>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Ex.: Interessados em imóveis na região"
            className="w-full rounded-lg border border-gray-200 px-2.5 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40"
          />
        </div>
      </div>
      <div className="flex items-center justify-end gap-2 border-t border-gray-100 pt-3">
        <button onClick={onClose} className="rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-50">
          Cancelar
        </button>
        <button
          onClick={save}
          disabled={saving || !name.trim()}
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50"
        >
          {saving && <Loader2 size={15} className="animate-spin" />} {list ? "Salvar" : "Criar lista"}
        </button>
      </div>
    </div>
  );
}

function ListRow({ list, onChanged }: { list: ContactList; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function remove() {
    try {
      await api(`/api/contact-lists/${list.id}`, { method: "DELETE" });
      toast({ title: "Lista removida", variant: "success" });
      onChanged();
    } catch (e) {
      toast({ title: "Erro ao remover", description: e instanceof Error ? e.message : "", variant: "error" });
    }
  }

  if (editing) {
    return (
      <li>
        <ListForm
          list={list}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            onChanged();
          }}
        />
      </li>
    );
  }

  return (
    <li className="rounded-xl border border-gray-200 bg-white">
      <div className="flex items-center gap-3 p-3">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          {open ? (
            <ChevronDown size={16} className="shrink-0 text-gray-400" />
          ) : (
            <ChevronRight size={16} className="shrink-0 text-gray-400" />
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="truncate font-semibold text-gray-900">{list.name}</span>
              <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-600">
                <Users size={10} /> {list.member_count ?? 0}
              </span>
            </div>
            {list.description && (
              <p className="mt-0.5 truncate text-[11px] text-gray-400">{list.description}</p>
            )}
          </div>
        </button>
        <div className="flex shrink-0 items-center gap-1">
          <button
            onClick={() => setEditing(true)}
            className="rounded-lg p-1.5 text-gray-300 hover:text-gray-600"
            title="Editar"
          >
            <Pencil size={15} />
          </button>
          <button
            onClick={() => setConfirmDelete(true)}
            className="rounded-lg p-1.5 text-gray-300 hover:text-red-500"
            title="Remover"
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>

      {open && <ListMembers listId={list.id} onChanged={onChanged} />}

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={(o) => !o && setConfirmDelete(false)}
        title="Remover lista?"
        description={`"${list.name}" será removida. Os contatos continuam no fonebook.`}
        confirmLabel="Remover"
        variant="danger"
        onConfirm={() => {
          remove();
          setConfirmDelete(false);
        }}
      />
    </li>
  );
}

function ListMembers({ listId, onChanged }: { listId: string; onChanged: () => void }) {
  const [members, setMembers] = useState<ContactLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [picked, setPicked] = useState<ContactLite[]>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api<{ members: ContactLite[] }>(`/api/contact-lists/${listId}`);
      setMembers(data.members || []);
    } catch {
      setMembers([]);
    } finally {
      setLoading(false);
    }
  }, [listId]);

  useEffect(() => {
    load();
  }, [load]);

  async function addPicked() {
    if (picked.length === 0 || busy) return;
    setBusy(true);
    try {
      await api(`/api/contact-lists/${listId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contact_ids: picked.map((c) => c.id) }),
      });
      toast({ title: "Contatos adicionados", description: `${picked.length} contato(s)`, variant: "success" });
      setPicked([]);
      setAdding(false);
      load();
      onChanged();
    } catch (e) {
      toast({ title: "Erro", description: e instanceof Error ? e.message : "", variant: "error" });
    } finally {
      setBusy(false);
    }
  }

  async function removeMember(contactId: string) {
    try {
      await api(`/api/contact-lists/${listId}/members`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contact_ids: [contactId] }),
      });
      setMembers((m) => m.filter((c) => c.id !== contactId));
      onChanged();
    } catch (e) {
      toast({ title: "Erro", description: e instanceof Error ? e.message : "", variant: "error" });
    }
  }

  async function toggleDoNotContact(c: ContactLite) {
    const next = !c.do_not_contact;
    try {
      await api(`/api/contacts/${c.id}/do-not-contact`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ do_not_contact: next }),
      });
      setMembers((m) => m.map((x) => (x.id === c.id ? { ...x, do_not_contact: next } : x)));
      toast({
        title: next ? "Contato marcado como 'não contatar'" : "Contato liberado para contato",
        variant: "success",
      });
    } catch (e) {
      toast({ title: "Erro", description: e instanceof Error ? e.message : "", variant: "error" });
    }
  }

  return (
    <div className="border-t border-gray-100 p-3">
      {!adding ? (
        <button
          onClick={() => setAdding(true)}
          className="mb-2 inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline"
        >
          <Plus size={13} /> Adicionar contatos
        </button>
      ) : (
        <div className="mb-3 space-y-2 rounded-lg border border-gray-200 bg-gray-50/50 p-3">
          <ContactPicker value={picked} onChange={setPicked} listHeight="h-52" />
          <div className="flex items-center justify-end gap-2">
            <button
              onClick={() => {
                setAdding(false);
                setPicked([]);
              }}
              className="rounded-lg px-2.5 py-1.5 text-xs text-gray-600 hover:bg-gray-100"
            >
              Cancelar
            </button>
            <button
              onClick={addPicked}
              disabled={busy || picked.length === 0}
              className="inline-flex items-center gap-1 rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-600 disabled:opacity-50"
            >
              {busy && <Loader2 size={13} className="animate-spin" />}
              Adicionar {picked.length > 0 ? `${picked.length}` : ""}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-6 text-gray-400">
          <Loader2 className="animate-spin" size={16} />
        </div>
      ) : members.length === 0 ? (
        <p className="py-4 text-center text-xs text-gray-400">Lista vazia.</p>
      ) : (
        <ul className="divide-y divide-gray-50 rounded-lg border border-gray-100">
          {members.map((c) => (
            <li key={c.id} className="flex items-center gap-3 px-3 py-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "truncate text-sm font-medium",
                      c.do_not_contact ? "text-gray-400 line-through" : "text-gray-900"
                    )}
                  >
                    {c.display_name || c.phone_e164 || c.phone_canonical}
                  </span>
                  {c.do_not_contact && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-500">
                      <Ban size={10} /> Não contatar
                    </span>
                  )}
                </div>
                <div className="truncate text-[11px] text-gray-400">
                  {c.phone_e164 || c.phone_canonical}
                  {c.category && ` · ${CONTACT_CATEGORY_LABELS[c.category] ?? c.category}`}
                </div>
              </div>
              <button
                onClick={() => toggleDoNotContact(c)}
                className={cn(
                  "rounded-lg p-1.5",
                  c.do_not_contact ? "text-red-400 hover:text-gray-500" : "text-gray-300 hover:text-red-500"
                )}
                title={c.do_not_contact ? "Liberar para contato" : "Marcar como 'não contatar' (opt-out)"}
              >
                <Ban size={15} />
              </button>
              <button
                onClick={() => removeMember(c.id)}
                className="rounded-lg p-1.5 text-gray-300 hover:text-red-500"
                title="Remover da lista"
              >
                <UserMinus size={15} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
