"use client";

import { useRouter } from "next/navigation";
import {
  Pencil,
  Trash2,
  MessageCircle,
  Instagram,
  Home,
  Ban,
  Star,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
} from "@/components/ui/dialog";
import { api } from "@/lib/chat/utils";
import { toast } from "@/components/ui/use-toast";
import { CONTACT_CATEGORY_LABELS, type ContactLite } from "@/types/campaign";

function waLink(phone: string | null | undefined): string {
  return `https://wa.me/${(phone || "").replace(/\D/g, "")}`;
}

/** Ficha somente-leitura do contato (o "R" do CRUD) com atalhos de ação. */
export function ContactViewDialog({
  contact,
  onClose,
  onEdit,
  onDelete,
}: {
  contact: ContactLite | null;
  onClose: () => void;
  onEdit: (c: ContactLite) => void;
  onDelete: (c: ContactLite) => void;
}) {
  const router = useRouter();
  if (!contact) return null;
  const c = contact;
  const phone = c.phone_e164 || c.phone_canonical;

  async function openChat() {
    try {
      const res = await api<{ conversation_id: string }>(`/api/contacts/${c.id}/start-conversation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      router.push(`/vendas?conversation=${res.conversation_id}`);
    } catch (e) {
      toast({ title: "Erro ao abrir conversa", description: e instanceof Error ? e.message : "", variant: "error" });
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 pr-6">
            <span className="truncate">{c.display_name || phone || "Contato"}</span>
            {c.do_not_contact && (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-500">
                <Ban size={10} /> Não contatar
              </span>
            )}
          </DialogTitle>
        </DialogHeader>
        <DialogBody className="space-y-3 text-sm">
          {/* Telefone com atalhos */}
          <Row label="Telefone">
            <span className="tabular-nums">{phone || "—"}</span>
            {phone && (
              <span className="ml-2 inline-flex gap-1 align-middle">
                <button onClick={openChat} className="rounded p-1 text-brand-500 hover:bg-brand-50" title="Abrir conversa no PMS">
                  <MessageCircle size={14} />
                </button>
                <a href={waLink(phone)} target="_blank" rel="noopener noreferrer" className="rounded p-1 text-green-600 hover:bg-green-50" title="WhatsApp (wa.me)">
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true"><path d="M17.5 14.4c-.3-.2-1.7-.8-2-.9-.3-.1-.5-.2-.7.2-.2.3-.7.9-.9 1.1-.2.2-.3.2-.6.1-1.7-.9-2.9-1.6-4-3.5-.3-.5.3-.5.8-1.6.1-.2 0-.4 0-.5 0-.2-.7-1.6-.9-2.2-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.5s1.1 2.9 1.2 3.1c.2.2 2.1 3.3 5.2 4.6 2 .8 2.7.9 3.7.8.6-.1 1.7-.7 2-1.4.2-.7.2-1.2.2-1.4-.1-.1-.3-.2-.6-.3zM12 2C6.5 2 2 6.5 2 12c0 1.8.5 3.4 1.3 4.9L2 22l5.3-1.4c1.4.8 3 1.2 4.7 1.2 5.5 0 10-4.5 10-10S17.5 2 12 2z" /></svg>
                </a>
              </span>
            )}
          </Row>
          <Row label="Primeiro nome">{c.first_name || "—"}</Row>
          <Row label="Sobrenome">{c.last_name || "—"}</Row>
          <Row label="Nome social">{c.social_name || "—"}</Row>
          <Row label="Instagram">
            {c.instagram_handle ? (
              <a href={`https://instagram.com/${c.instagram_handle}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-pink-600 hover:underline">
                <Instagram size={12} /> {c.instagram_handle}
              </a>
            ) : "—"}
          </Row>
          <Row label="Unidade">
            {c.unit_hint ? (
              <span className="inline-flex items-center gap-1 text-brand-700"><Home size={12} /> {c.unit_hint}</span>
            ) : "—"}
          </Row>
          <Row label="Categoria">{c.category ? CONTACT_CATEGORY_LABELS[c.category] ?? c.category : "—"}</Row>
          <Row label="Avaliação">
            {c.rating ? (
              <span className="inline-flex items-center gap-0.5 text-amber-500">
                {Array.from({ length: c.rating }).map((_, i) => <Star key={i} size={13} className="fill-amber-400 text-amber-400" />)}
              </span>
            ) : "—"}
          </Row>
          <Row label="Tags">
            {(c.tags?.length ?? 0) > 0 ? (
              <span className="flex flex-wrap gap-1">
                {c.tags!.map((t) => (
                  <span key={t} className="rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-medium text-brand-700">{t}</span>
                ))}
              </span>
            ) : "—"}
          </Row>
          {c.notes && (
            <div>
              <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-gray-400">Notas</div>
              <p className="whitespace-pre-wrap rounded-lg bg-gray-50 p-2.5 text-xs text-gray-700">{c.notes}</p>
            </div>
          )}
        </DialogBody>
        <DialogFooter>
          <button onClick={onClose} className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-50">
            <X size={14} /> Fechar
          </button>
          <button onClick={() => onDelete(c)} className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-3 py-2 text-sm text-red-600 hover:bg-red-50">
            <Trash2 size={14} /> Excluir
          </button>
          <button onClick={() => onEdit(c)} className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600">
            <Pencil size={14} /> Editar
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-gray-50 pb-2">
      <span className="shrink-0 text-[11px] font-medium uppercase tracking-wide text-gray-400">{label}</span>
      <span className="text-right text-gray-800">{children}</span>
    </div>
  );
}
