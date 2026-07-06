"use client";

import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { MessageSquare, CalendarPlus, CalendarX, Bell, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { NotificationItem } from "@/lib/db/queries/notifications";

const ICON_BY_TYPE: Record<string, { icon: LucideIcon; tone: string }> = {
  "whatsapp.message": { icon: MessageSquare, tone: "bg-brand-500/10 text-brand-600" },
  "reservation.created": { icon: CalendarPlus, tone: "bg-emerald-500/10 text-emerald-600" },
  "reservation.canceled": { icon: CalendarX, tone: "bg-red-500/10 text-red-600" },
};

/**
 * Linha de notificação — compartilhada entre o dropdown do sino e a página cheia.
 * Renderiza como <Link> quando há `link`, senão como <div>. Chama `onActivate`
 * (marcar como lida) ao clicar.
 */
export function NotificationRow({
  n,
  onActivate,
}: {
  n: NotificationItem;
  onActivate?: (n: NotificationItem) => void;
}) {
  const meta = ICON_BY_TYPE[n.type] ?? { icon: Bell, tone: "bg-gray-100 text-gray-500" };
  const Icon = meta.icon;
  const unread = !n.read_at;

  const inner = (
    <>
      <span className={cn("mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full", meta.tone)}>
        <Icon size={15} aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          <p className={cn("text-sm leading-snug text-gray-900", unread && "font-semibold")}>{n.title}</p>
          {unread && <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" aria-label="Não lida" />}
        </div>
        {n.body && <p className="mt-0.5 truncate text-xs text-gray-500">{n.body}</p>}
        <p className="mt-0.5 text-[11px] text-gray-400">
          {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: ptBR })}
        </p>
      </div>
    </>
  );

  const cls = cn(
    "flex items-start gap-3 px-3 py-3 transition-colors duration-150 sm:px-4",
    unread ? "bg-brand-500/[0.03]" : "bg-white",
    n.link && "hover:bg-gray-50"
  );

  if (n.link) {
    return (
      <Link href={n.link} onClick={() => onActivate?.(n)} className={cn(cls, "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40")}>
        {inner}
      </Link>
    );
  }
  return (
    <button type="button" onClick={() => onActivate?.(n)} className={cn(cls, "w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40")}>
      {inner}
    </button>
  );
}
