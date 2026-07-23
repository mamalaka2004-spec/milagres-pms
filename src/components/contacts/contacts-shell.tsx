"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  Plus,
  Loader2,
  Pencil,
  Trash2,
  Ban,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Check,
  Instagram,
  Tag as TagIcon,
  BookUser,
  History,
  MessageCircle,
  ListPlus,
  Megaphone,
  Target,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { api } from "@/lib/chat/utils";
import { toast } from "@/components/ui/use-toast";
import { ConfirmDialog } from "@/components/ui";
import { StarRating } from "./star-rating";
import { ContactFormDialog } from "./contact-form-dialog";
import { NameCleanupDialog } from "./name-cleanup-dialog";
import { NameChangesTab } from "./name-changes-tab";
import { SelectionActionDialog } from "./selection-action-dialog";
import { nameNeedsReview } from "@/lib/contacts/name";
import { CONTACT_CATEGORY_LABELS, type ContactLite, type ContactList } from "@/types/campaign";

const PAGE_SIZES = [25, 50, 100];

const CATEGORY_COLORS: Record<string, string> = {
  guest: "#3b82f6",
  guest_maybe: "#8b5cf6",
  lead: "#10b981",
  provider: "#f59e0b",
  spam: "#ef4444",
  personal: "#6b7280",
};

/** Só dígitos (para wa.me). */
function waLink(phone: string | null | undefined): string {
  const d = (phone || "").replace(/\D/g, "");
  return `https://wa.me/${d}`;
}

export function ContactsShell() {
  const [tab, setTab] = useState<"lista" | "alteracoes">("lista");
  return (
    <div className="space-y-5">
      <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-1">
        {([
          { id: "lista", label: "Contatos", icon: BookUser },
          { id: "alteracoes", label: "Nomes organizados", icon: History },
        ] as const).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-4 py-1.5 text-sm font-medium transition-colors",
              tab === t.id ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
            )}
          >
            <t.icon size={14} /> {t.label}
          </button>
        ))}
      </div>
      {tab === "lista" ? <ContactsList /> : <NameChangesTab />}
    </div>
  );
}

function ContactsList() {
  const router = useRouter();
  const [contacts, setContacts] = useState<ContactLite[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(50);

  // Filtros
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [tag, setTag] = useState("");
  const [minRating, setMinRating] = useState(0);
  const [dnc, setDnc] = useState("");
  const [nameStatus, setNameStatus] = useState("");
  const [allTags, setAllTags] = useState<string[]>([]);

  // Dialogs
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ContactLite | null>(null);
  const [deleting, setDeleting] = useState<ContactLite | null>(null);
  const [cleanupOpen, setCleanupOpen] = useState(false);
  const [selectionAction, setSelectionAction] = useState<"list" | "campaign" | "prospect" | null>(null);

  // Seleção em massa
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const [lists, setLists] = useState<ContactList[]>([]);

  /** Parâmetros dos filtros ativos (compartilhado entre lista e "selecionar todos"). */
  const filterParams = useCallback(() => {
    const p = new URLSearchParams();
    if (q.trim()) p.set("q", q.trim());
    if (category) p.set("category", category);
    if (tag) p.set("tag", tag);
    if (minRating) p.set("min_rating", String(minRating));
    if (dnc) p.set("dnc", dnc);
    if (nameStatus) p.set("name_status", nameStatus);
    return p;
  }, [q, category, tag, minRating, dnc, nameStatus]);

  const loadTags = useCallback(() => {
    api<string[]>(`/api/contacts/tags`).then(setAllTags).catch(() => setAllTags([]));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = filterParams();
      params.set("paged", "1");
      params.set("limit", String(pageSize));
      params.set("offset", String(page * pageSize));
      const res = await api<{ contacts: ContactLite[]; total: number }>(`/api/contacts?${params}`);
      setContacts(res.contacts);
      setTotal(res.total);
    } catch {
      setContacts([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [filterParams, pageSize, page]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  useEffect(() => {
    loadTags();
    api<ContactList[]>(`/api/contact-lists`).then(setLists).catch(() => setLists([]));
  }, [loadTags]);

  // ── Ações em massa ──
  const allOnPageSelected = contacts.length > 0 && contacts.every((c) => selected.has(c.id));

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function toggleSelectAll() {
    setSelected((prev) => {
      if (allOnPageSelected) {
        const next = new Set(prev);
        for (const c of contacts) next.delete(c.id);
        return next;
      }
      return new Set([...prev, ...contacts.map((c) => c.id)]);
    });
  }

  async function bulk(action: string, extra: Record<string, unknown> = {}, label?: string) {
    if (selected.size === 0 || bulkBusy) return;
    setBulkBusy(true);
    try {
      const res = await api<{ affected: number }>(`/api/contacts/bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contact_ids: [...selected], action, ...extra }),
      });
      toast({ title: label ?? "Contatos atualizados", description: `${res.affected} contato(s)`, variant: "success" });
      setSelected(new Set());
      load();
      loadTags();
    } catch (e) {
      toast({ title: "Erro", description: e instanceof Error ? e.message : "", variant: "error" });
    } finally {
      setBulkBusy(false);
    }
  }

  function bulkAddTag() {
    const t = window.prompt("Tag a adicionar nos contatos selecionados:");
    if (t?.trim()) bulk("add_tags", { tags: [t.trim()] }, "Tag adicionada");
  }

  /** Seleciona TODOS os contatos que batem no filtro atual (além da página). */
  async function selectAllMatching() {
    setBulkBusy(true);
    try {
      const res = await api<{ ids: string[] }>(`/api/contacts?ids=1&${filterParams()}`);
      setSelected(new Set(res.ids));
      toast({ title: `${res.ids.length} contato(s) selecionado(s)`, variant: "success" });
    } catch (e) {
      toast({ title: "Erro", description: e instanceof Error ? e.message : "", variant: "error" });
    } finally {
      setBulkBusy(false);
    }
  }

  /** Abre o chat interno do contato (sem duplicar conversa existente). */
  async function openConversation(c: ContactLite) {
    try {
      const res = await api<{ conversation_id: string }>(`/api/contacts/${c.id}/start-conversation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      router.push(`/vendas?conversation=${res.conversation_id}`);
    } catch (e) {
      toast({ title: "Não foi possível abrir a conversa", description: e instanceof Error ? e.message : "", variant: "error" });
    }
  }

  // Reset de página quando o filtro muda.
  useEffect(() => {
    setPage(0);
  }, [q, category, tag, minRating, dnc, nameStatus, pageSize]);

  async function toggleDnc(c: ContactLite) {
    const next = !c.do_not_contact;
    try {
      await api(`/api/contacts/${c.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ do_not_contact: next }),
      });
      setContacts((cs) => cs.map((x) => (x.id === c.id ? { ...x, do_not_contact: next } : x)));
      toast({ title: next ? "Marcado como 'não contatar'" : "Liberado para contato", variant: "success" });
    } catch (e) {
      toast({ title: "Erro", description: e instanceof Error ? e.message : "", variant: "error" });
    }
  }

  async function setRatingInline(c: ContactLite, rating: number | null) {
    try {
      await api(`/api/contacts/${c.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating }),
      });
      setContacts((cs) => cs.map((x) => (x.id === c.id ? { ...x, rating } : x)));
    } catch (e) {
      toast({ title: "Erro", description: e instanceof Error ? e.message : "", variant: "error" });
    }
  }

  async function remove(c: ContactLite) {
    try {
      await api(`/api/contacts/${c.id}`, { method: "DELETE" });
      toast({ title: "Contato removido", variant: "success" });
      load();
    } catch (e) {
      toast({ title: "Erro ao remover", description: e instanceof Error ? e.message : "", variant: "error" });
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const selectClass =
    "rounded-lg border border-gray-200 bg-white px-2.5 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40";

  return (
    <div className="space-y-4">
      {/* Filtros + novo */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1 basis-56">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por nome ou telefone…"
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
        <select value={dnc} onChange={(e) => setDnc(e.target.value)} className={selectClass}>
          <option value="">Todos</option>
          <option value="0">Contatáveis</option>
          <option value="1">Não contatar</option>
        </select>
        <select value={nameStatus} onChange={(e) => setNameStatus(e.target.value)} className={selectClass}>
          <option value="">Qualquer nome</option>
          <option value="ok">Nome tratado</option>
          <option value="sem_nome">Sem primeiro nome</option>
          <option value="pendente">Não revisado</option>
        </select>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => setCleanupOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-purple-200 bg-purple-50 px-3 py-2 text-sm font-medium text-purple-700 hover:bg-purple-100"
            title="Analisa nomes bagunçados (Instagram, emojis, MAIÚSCULAS) e sugere Nome/Sobrenome/Nome social"
          >
            <Sparkles size={15} /> Organizar nomes
          </button>
          <button
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-3 py-2 text-sm font-medium text-white hover:bg-brand-600"
          >
            <Plus size={16} /> Novo contato
          </button>
        </div>
      </div>

      {/* Barra de ações em massa */}
      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-brand-200 bg-brand-50/60 px-3 py-2">
          <span className="text-xs font-semibold text-brand-900">
            {selected.size} selecionado(s)
          </span>
          {selected.size < total && (
            <button onClick={selectAllMatching} disabled={bulkBusy} className="text-xs font-medium text-brand-600 hover:underline">
              selecionar todos os {total}
            </button>
          )}
          <button onClick={() => setSelected(new Set())} className="text-xs text-gray-500 hover:underline">
            limpar
          </button>
          <div className="mx-1 h-4 w-px bg-brand-200" />

          {/* Ações rápidas: transformar a seleção em lista / campanha / prospecção */}
          <button onClick={() => setSelectionAction("list")} disabled={bulkBusy} className="inline-flex items-center gap-1 rounded-lg border border-brand-300 bg-white px-2 py-1 text-xs font-medium text-brand-700 hover:bg-brand-50 disabled:opacity-50">
            <ListPlus size={12} /> Nova lista
          </button>
          <button onClick={() => setSelectionAction("campaign")} disabled={bulkBusy} className="inline-flex items-center gap-1 rounded-lg border border-brand-300 bg-white px-2 py-1 text-xs font-medium text-brand-700 hover:bg-brand-50 disabled:opacity-50">
            <Megaphone size={12} /> Nova campanha
          </button>
          <button onClick={() => setSelectionAction("prospect")} disabled={bulkBusy} className="inline-flex items-center gap-1 rounded-lg border border-brand-300 bg-white px-2 py-1 text-xs font-medium text-brand-700 hover:bg-brand-50 disabled:opacity-50">
            <Target size={12} /> Prospecção
          </button>
          <div className="mx-1 h-4 w-px bg-brand-200" />

          <select
            value=""
            disabled={bulkBusy}
            onChange={(e) => e.target.value && bulk("set_category", { category: e.target.value }, "Categoria alterada")}
            className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs"
          >
            <option value="">Categoria…</option>
            {Object.entries(CONTACT_CATEGORY_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>

          <select
            value=""
            disabled={bulkBusy}
            onChange={(e) => e.target.value && bulk("set_rating", { rating: Number(e.target.value) }, "Rating aplicado")}
            className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs"
          >
            <option value="">Rating…</option>
            {[5, 4, 3, 2, 1].map((n) => (
              <option key={n} value={n}>{"★".repeat(n)}</option>
            ))}
          </select>

          <button onClick={bulkAddTag} disabled={bulkBusy} className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-50">
            <TagIcon size={12} /> Add tag
          </button>

          {lists.length > 0 && (
            <select
              value=""
              disabled={bulkBusy}
              onChange={(e) => e.target.value && bulk("add_to_list", { list_id: e.target.value }, "Adicionados à lista")}
              className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs"
            >
              <option value="">Adicionar à lista…</option>
              {lists.map((l) => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
          )}

          <button onClick={() => setCleanupOpen(true)} disabled={bulkBusy} className="inline-flex items-center gap-1 rounded-lg border border-purple-200 bg-white px-2 py-1 text-xs text-purple-700 hover:bg-purple-50 disabled:opacity-50">
            <Sparkles size={12} /> Organizar nomes
          </button>

          <button onClick={() => bulk("set_do_not_contact", { do_not_contact: true }, "Marcados como 'não contatar'")} disabled={bulkBusy} className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-50">
            <Ban size={12} /> Não contatar
          </button>

          <button onClick={() => setConfirmBulkDelete(true)} disabled={bulkBusy} className="ml-auto inline-flex items-center gap-1 rounded-lg border border-red-200 bg-white px-2 py-1 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50">
            <Trash2 size={12} /> Excluir
          </button>
          {bulkBusy && <Loader2 size={14} className="animate-spin text-brand-600" />}
        </div>
      )}

      {/* Lista */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        {loading ? (
          <div className="flex justify-center py-16 text-gray-400">
            <Loader2 className="animate-spin" size={20} />
          </div>
        ) : contacts.length === 0 ? (
          <div className="py-14 text-center text-sm text-gray-400">Nenhum contato encontrado.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/60 text-left text-[11px] uppercase tracking-wide text-gray-400">
                  <th className="w-10 px-3 py-2.5">
                    <button
                      type="button"
                      onClick={toggleSelectAll}
                      className={cn(
                        "flex h-4 w-4 items-center justify-center rounded border",
                        allOnPageSelected ? "border-brand-500 bg-brand-500 text-white" : "border-gray-300"
                      )}
                      title={allOnPageSelected ? "Desmarcar página" : "Selecionar página"}
                    >
                      {allOnPageSelected && <Check size={11} />}
                    </button>
                  </th>
                  <th className="px-4 py-2.5 font-medium">Contato</th>
                  <th className="px-3 py-2.5 font-medium">Telefone / WhatsApp</th>
                  <th className="px-3 py-2.5 font-medium">Nome</th>
                  <th className="px-3 py-2.5 font-medium">Sobrenome</th>
                  <th className="px-3 py-2.5 font-medium">Nome social</th>
                  <th className="px-3 py-2.5 font-medium">Instagram</th>
                  <th className="px-3 py-2.5 font-medium">Unidade</th>
                  <th className="px-4 py-2.5 font-medium">Categoria</th>
                  <th className="px-4 py-2.5 font-medium">Tags</th>
                  <th className="px-4 py-2.5 font-medium">Rating</th>
                  <th className="px-4 py-2.5 text-right font-medium">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {contacts.map((c) => {
                  const catColor = c.category ? CATEGORY_COLORS[c.category] ?? "#6b7280" : null;
                  const sel = selected.has(c.id);
                  const dirtyName = nameNeedsReview(c.display_name);
                  return (
                    <tr key={c.id} className={cn("hover:bg-gray-50/50", sel && "bg-brand-50/40")}>
                      <td className="px-3 py-2.5">
                        <button
                          type="button"
                          onClick={() => toggleSelect(c.id)}
                          className={cn(
                            "flex h-4 w-4 items-center justify-center rounded border",
                            sel ? "border-brand-500 bg-brand-500 text-white" : "border-gray-300"
                          )}
                        >
                          {sel && <Check size={11} />}
                        </button>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <span className={cn("font-medium", c.do_not_contact ? "text-gray-400 line-through" : "text-gray-900")}>
                            {c.display_name || "—"}
                          </span>
                          {dirtyName && !c.do_not_contact && (
                            <span
                              className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-1.5 py-0.5 text-[9px] font-semibold text-amber-600"
                              title="Nome precisa de revisão — pode sair errado no {{primeiro_nome}} da campanha"
                            >
                              <Sparkles size={9} /> revisar nome
                            </span>
                          )}
                          {c.do_not_contact && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-1.5 py-0.5 text-[9px] font-semibold text-red-500">
                              <Ban size={9} /> Não contatar
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] tabular-nums text-gray-600">
                            {c.phone_e164 || c.phone_canonical || "—"}
                          </span>
                          {(c.phone_e164 || c.phone_canonical) && (
                            <>
                              <button
                                onClick={() => openConversation(c)}
                                className="rounded p-1 text-brand-500 hover:bg-brand-50"
                                title="Abrir conversa no PMS (sem duplicar)"
                              >
                                <MessageCircle size={13} />
                              </button>
                              <a
                                href={waLink(c.phone_e164 || c.phone_canonical)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="rounded p-1 text-green-600 hover:bg-green-50"
                                title="Abrir no WhatsApp (wa.me)"
                              >
                                <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor" aria-hidden="true">
                                  <path d="M17.5 14.4c-.3-.2-1.7-.8-2-.9-.3-.1-.5-.2-.7.2-.2.3-.7.9-.9 1.1-.2.2-.3.2-.6.1-1.7-.9-2.9-1.6-4-3.5-.3-.5.3-.5.8-1.6.1-.2 0-.4 0-.5 0-.2-.7-1.6-.9-2.2-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.5s1.1 2.9 1.2 3.1c.2.2 2.1 3.3 5.2 4.6 2 .8 2.7.9 3.7.8.6-.1 1.7-.7 2-1.4.2-.7.2-1.2.2-1.4-.1-.1-.3-.2-.6-.3zM12 2C6.5 2 2 6.5 2 12c0 1.8.5 3.4 1.3 4.9L2 22l5.3-1.4c1.4.8 3 1.2 4.7 1.2 5.5 0 10-4.5 10-10S17.5 2 12 2z" />
                                </svg>
                              </a>
                            </>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        {c.first_name ? (
                          <span className="font-medium text-gray-800">{c.first_name}</span>
                        ) : (
                          <span className="text-[11px] italic text-amber-600">sem nome</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-gray-600">
                        {c.last_name || <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-3 py-2.5 text-gray-600">
                        {c.social_name || <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-3 py-2.5">
                        {c.instagram_handle ? (
                          <a
                            href={`https://instagram.com/${c.instagram_handle}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] text-pink-600 hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Instagram size={11} /> {c.instagram_handle}
                          </a>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-[11px] text-gray-600">
                        {c.unit_hint || <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-2.5">
                        {c.category ? (
                          <span
                            className="inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold"
                            style={{ color: catColor!, background: `${catColor}18` }}
                          >
                            {CONTACT_CATEGORY_LABELS[c.category] ?? c.category}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex max-w-56 flex-wrap gap-1">
                          {(c.tags ?? []).slice(0, 4).map((t) => (
                            <button
                              key={t}
                              onClick={() => setTag(t)}
                              className="rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-medium text-brand-700 hover:bg-brand-100"
                              title={`Filtrar por "${t}"`}
                            >
                              {t}
                            </button>
                          ))}
                          {(c.tags?.length ?? 0) > 4 && (
                            <span className="text-[10px] text-gray-400">+{c.tags!.length - 4}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        <StarRating value={c.rating} onChange={(v) => setRatingInline(c, v)} />
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center justify-end gap-0.5">
                          <button
                            onClick={() => {
                              setEditing(c);
                              setFormOpen(true);
                            }}
                            className="rounded-lg p-1.5 text-gray-300 hover:text-gray-600"
                            title="Editar"
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            onClick={() => toggleDnc(c)}
                            className={cn("rounded-lg p-1.5", c.do_not_contact ? "text-red-400 hover:text-gray-500" : "text-gray-300 hover:text-red-500")}
                            title={c.do_not_contact ? "Liberar para contato" : "Marcar 'não contatar'"}
                          >
                            <Ban size={15} />
                          </button>
                          <button
                            onClick={() => setDeleting(c)}
                            className="rounded-lg p-1.5 text-gray-300 hover:text-red-500"
                            title="Excluir"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Paginação */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500">
        <div className="flex items-center gap-2">
          <span>{total} contato(s)</span>
          <span className="text-gray-300">·</span>
          <label className="flex items-center gap-1">
            por página:
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="rounded border border-gray-200 bg-white px-1.5 py-0.5 text-xs"
            >
              {PAGE_SIZES.map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </label>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(0)}
              disabled={page === 0}
              className="rounded-lg border border-gray-200 px-2 py-1 text-gray-500 hover:bg-gray-50 disabled:opacity-40"
            >
              «
            </button>
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="rounded-lg border border-gray-200 p-1.5 text-gray-500 hover:bg-gray-50 disabled:opacity-40"
            >
              <ChevronLeft size={14} />
            </button>
            <span className="px-2">
              página <b className="text-gray-700">{page + 1}</b> de {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="rounded-lg border border-gray-200 p-1.5 text-gray-500 hover:bg-gray-50 disabled:opacity-40"
            >
              <ChevronRight size={14} />
            </button>
            <button
              onClick={() => setPage(totalPages - 1)}
              disabled={page >= totalPages - 1}
              className="rounded-lg border border-gray-200 px-2 py-1 text-gray-500 hover:bg-gray-50 disabled:opacity-40"
            >
              »
            </button>
          </div>
        )}
      </div>

      <ContactFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        contact={editing}
        tagSuggestions={allTags}
        onSaved={() => {
          load();
          loadTags();
        }}
      />

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Excluir contato?"
        description={`"${deleting?.display_name || deleting?.phone_e164}" será removido do fonebook (sai também das listas).`}
        confirmLabel="Excluir"
        variant="danger"
        onConfirm={() => {
          if (deleting) remove(deleting);
          setDeleting(null);
        }}
      />

      <ConfirmDialog
        open={confirmBulkDelete}
        onOpenChange={(o) => !o && setConfirmBulkDelete(false)}
        title={`Excluir ${selected.size} contato(s)?`}
        description="Eles serão removidos do fonebook e de todas as listas. Não dá para desfazer."
        confirmLabel="Excluir todos"
        variant="danger"
        onConfirm={() => {
          bulk("delete", {}, "Contatos excluídos");
          setConfirmBulkDelete(false);
        }}
      />

      <NameCleanupDialog
        open={cleanupOpen}
        onOpenChange={setCleanupOpen}
        contactIds={selected.size > 0 ? [...selected] : undefined}
        onApplied={() => {
          setSelected(new Set());
          load();
        }}
      />

      <SelectionActionDialog
        action={selectionAction}
        contactIds={[...selected]}
        onClose={() => setSelectionAction(null)}
        onDone={() => {
          setSelectionAction(null);
          setSelected(new Set());
          load();
        }}
      />
    </div>
  );
}
