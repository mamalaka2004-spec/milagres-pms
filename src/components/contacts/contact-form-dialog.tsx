"use client";

import { useEffect, useState } from "react";
import { X, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "@/components/ui/use-toast";
import { api } from "@/lib/chat/utils";
import { StarRating } from "./star-rating";
import { CONTACT_CATEGORY_LABELS, type ContactLite } from "@/types/campaign";

const inputClass =
  "w-full rounded-lg border border-gray-200 px-2.5 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40";
const labelClass = "mb-1 block text-xs font-medium text-gray-600";

/** Criar/editar contato do fonebook. `contact` presente = edição. */
export function ContactFormDialog({
  open,
  onOpenChange,
  contact,
  tagSuggestions = [],
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  contact?: ContactLite | null;
  tagSuggestions?: string[];
  onSaved: (c: ContactLite) => void;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [category, setCategory] = useState("lead");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [rating, setRating] = useState<number | null>(null);
  const [notes, setNotes] = useState("");
  const [dnc, setDnc] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(contact?.display_name ?? "");
    setPhone(contact?.phone_e164 ?? "");
    setCategory(contact?.category ?? "lead");
    setTags(contact?.tags ?? []);
    setTagInput("");
    setRating(contact?.rating ?? null);
    setNotes(contact?.notes ?? "");
    setDnc(contact?.do_not_contact ?? false);
  }, [open, contact]);

  function addTag(raw: string) {
    const t = raw.trim().toLowerCase();
    if (!t || tags.includes(t)) return;
    setTags([...tags, t]);
    setTagInput("");
  }

  async function save() {
    if (!name.trim() || !phone.trim() || saving) return;
    setSaving(true);
    try {
      const body = JSON.stringify({
        display_name: name.trim(),
        phone: phone.trim(),
        category,
        tags,
        rating,
        notes: notes.trim() || null,
        do_not_contact: dnc,
      });
      const saved = contact
        ? await api<ContactLite>(`/api/contacts/${contact.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body,
          })
        : await api<ContactLite>(`/api/contacts`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body,
          });
      toast({ title: contact ? "Contato atualizado" : "Contato criado", variant: "success" });
      onSaved(saved);
      onOpenChange(false);
    } catch (e) {
      toast({ title: "Erro", description: e instanceof Error ? e.message : "", variant: "error" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{contact ? "Editar contato" : "Novo contato"}</DialogTitle>
        </DialogHeader>
        <DialogBody className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Nome *</label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: João Silva" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Telefone (com DDD) *</label>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+55 82 99999-9999" className={inputClass} />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Categoria</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)} className={inputClass}>
                {Object.entries(CONTACT_CATEGORY_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Avaliação</label>
              <div className="flex h-9 items-center">
                <StarRating value={rating} onChange={setRating} size={20} />
              </div>
            </div>
          </div>

          <div>
            <label className={labelClass}>Tags <span className="text-gray-400">(Enter para adicionar)</span></label>
            <input
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === ",") {
                  e.preventDefault();
                  addTag(tagInput);
                }
              }}
              list="contact-tag-suggestions"
              placeholder="Ex.: investidor, indicação…"
              className={inputClass}
            />
            <datalist id="contact-tag-suggestions">
              {tagSuggestions.filter((t) => !tags.includes(t)).map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>
            {tags.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {tags.map((t) => (
                  <span key={t} className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-medium text-brand-700">
                    {t}
                    <X size={11} className="cursor-pointer opacity-60 hover:opacity-100" onClick={() => setTags(tags.filter((x) => x !== t))} />
                  </span>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className={labelClass}>Notas</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Observações sobre o contato…" className={`${inputClass} resize-y`} />
          </div>

          <label className="flex items-center gap-2 text-xs text-gray-600">
            <input type="checkbox" checked={dnc} onChange={(e) => setDnc(e.target.checked)} className="accent-red-500" />
            Não contatar (opt-out — nunca entra em campanhas)
          </label>
        </DialogBody>
        <DialogFooter>
          <button onClick={() => onOpenChange(false)} className="rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-50">
            Cancelar
          </button>
          <button
            onClick={save}
            disabled={saving || !name.trim() || !phone.trim()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50"
          >
            {saving && <Loader2 size={15} className="animate-spin" />} {contact ? "Salvar" : "Criar contato"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
