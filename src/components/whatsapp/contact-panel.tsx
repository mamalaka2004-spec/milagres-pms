"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Star, Pin, Mail, User, CalendarCheck, ExternalLink, Phone, Loader2, Home, Tag,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { createClient } from "@/lib/supabase/client";
import { canonicalBR } from "@/lib/whatsapp/phone";
import type { Database } from "@/types/database";

type ConvRow = Database["public"]["Tables"]["whatsapp_conversations"]["Row"];
type ConvWithFlags = ConvRow & { important?: boolean | null; marked_unread?: boolean | null };
type WaContact = Database["public"]["Tables"]["whatsapp_contacts"]["Row"];

const CATEGORY_LABEL: Record<string, string> = {
  guest: "Hóspede", guest_maybe: "Possível hóspede", lead: "Lead / cotação",
  provider: "Prestador", personal: "Pessoal", spam: "Spam",
};

async function patchConversation(id: string, patch: Record<string, unknown>) {
  const res = await fetch(`/api/whatsapp/conversations/${id}`, {
    method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch),
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error || `HTTP ${res.status}`);
  return json.data;
}

export function ContactPanel({ conversation, onChange }: { conversation: ConvWithFlags; onChange: () => void; }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [waContact, setWaContact] = useState<WaContact | null>(null);
  const supabase = useMemo(() => createClient(), []);

  // Pull the matching imported contact (category / unit / original label).
  useEffect(() => {
    let cancelled = false;
    const key = canonicalBR(conversation.contact_phone);
    if (!key) { setWaContact(null); return; }
    (async () => {
      const { data } = await supabase
        .from("whatsapp_contacts")
        .select("*")
        .eq("phone_canonical", key)
        .limit(1)
        .maybeSingle();
      if (!cancelled) setWaContact((data as WaContact | null) ?? null);
    })();
    return () => { cancelled = true; };
  }, [supabase, conversation.contact_phone]);

  async function toggle(field: "important" | "marked_unread" | "pinned", value: boolean) {
    setBusy(field);
    try { await patchConversation(conversation.id, { [field]: value }); onChange(); }
    catch { /* migration not run / ignore */ }
    finally { setBusy(null); }
  }

  const name = conversation.contact_name || conversation.contact_phone;
  const initials = (name || "?").split(/\s+/).slice(0, 2).map((p) => p[0]).join("").toUpperCase();

  const flagBtn = (active: boolean) =>
    cn("w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40",
      active ? "bg-brand-50 text-brand-700 border-brand-200" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50");

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 h-16 flex items-center border-b border-gray-100 bg-white shrink-0">
        <h3 className="font-semibold text-sm text-gray-900">Contato</h3>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5 scrollbar-thin">
        {/* Identity */}
        <div className="flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-full bg-brand-500/15 text-brand-700 flex items-center justify-center text-xl font-semibold mb-2">
            {initials.slice(0, 2)}
          </div>
          <div className="font-semibold text-gray-900">{name}</div>
          <a
            href={`https://wa.me/${(conversation.contact_phone || "").replace(/\D/g, "")}`}
            target="_blank" rel="noopener noreferrer"
            className="text-[11px] text-gray-500 inline-flex items-center gap-1 mt-0.5 hover:text-brand-600 transition-colors duration-150"
          >
            <Phone size={11} aria-hidden="true" /> {conversation.contact_phone}
          </a>
          {waContact?.category && (
            <span className={cn(
              "mt-2 inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border",
              waContact.category === "guest" || waContact.category === "guest_maybe"
                ? "bg-brand-50 text-brand-700 border-brand-200"
                : waContact.category === "lead" ? "bg-amber-50 text-amber-700 border-amber-200"
                : "bg-gray-50 text-gray-600 border-gray-200"
            )}>
              <Tag size={10} /> {CATEGORY_LABEL[waContact.category] || waContact.category}
            </span>
          )}
        </div>

        {/* Imported-list details */}
        {waContact && (waContact.unit_hint || waContact.raw_label) && (
          <div className="space-y-2">
            <span className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Da sua lista</span>
            {waContact.unit_hint && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-700">
                <Home size={14} className="text-brand-400" aria-hidden="true" />
                <span className="capitalize">{waContact.unit_hint.replace(/-/g, " ")}</span>
              </div>
            )}
            {waContact.raw_label && (
              <p className="text-xs text-gray-500 bg-gray-50 border border-gray-100 rounded-lg p-2.5 break-words">{waContact.raw_label}</p>
            )}
          </div>
        )}

        {/* Triage flags */}
        <div className="space-y-1.5">
          <span className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Triagem</span>
          <button onClick={() => toggle("important", !conversation.important)} disabled={busy === "important"} aria-pressed={!!conversation.important} className={flagBtn(!!conversation.important)}>
            {busy === "important" ? <Loader2 size={15} className="animate-spin" /> : <Star size={15} className={conversation.important ? "fill-brand-500 text-brand-500" : ""} />} Importante
          </button>
          <button onClick={() => toggle("marked_unread", !conversation.marked_unread)} disabled={busy === "marked_unread"} aria-pressed={!!conversation.marked_unread} className={flagBtn(!!conversation.marked_unread)}>
            {busy === "marked_unread" ? <Loader2 size={15} className="animate-spin" /> : <Mail size={15} />} Marcar não lido
          </button>
          <button onClick={() => toggle("pinned", !conversation.pinned)} disabled={busy === "pinned"} aria-pressed={!!conversation.pinned} className={flagBtn(!!conversation.pinned)}>
            {busy === "pinned" ? <Loader2 size={15} className="animate-spin" /> : <Pin size={15} />} {conversation.pinned ? "Fixada" : "Fixar conversa"}
          </button>
        </div>

        {/* Linked records */}
        <div className="space-y-1.5">
          <span className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Vínculos</span>
          {conversation.guest_id ? (
            <Link href={`/guests/${conversation.guest_id}`} className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40 group">
              <span className="flex items-center gap-2 text-sm text-gray-700"><User size={14} className="text-brand-400" /> Ver hóspede</span>
              <ExternalLink size={13} className="text-gray-300 group-hover:text-gray-500" />
            </Link>
          ) : (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-gray-200 text-sm text-gray-400"><User size={14} /> Sem hóspede vinculado</div>
          )}
          {conversation.reservation_id ? (
            <Link href={`/reservations/${conversation.reservation_id}`} className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40 group">
              <span className="flex items-center gap-2 text-sm text-gray-700"><CalendarCheck size={14} className="text-brand-400" /> Ver reserva</span>
              <ExternalLink size={13} className="text-gray-300 group-hover:text-gray-500" />
            </Link>
          ) : (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-gray-200 text-sm text-gray-400"><CalendarCheck size={14} /> Sem reserva vinculada</div>
          )}
        </div>
      </div>
    </div>
  );
}
