"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Bell, CheckCheck, Loader2 } from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent, PopoverClose } from "@/components/ui/popover";
import { NotificationRow } from "@/components/notifications/shared";
import type { NotificationItem } from "@/lib/db/queries/notifications";

const POLL_MS = 60_000;
const PREVIEW_LIMIT = 8;

export function NotificationBell() {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/notifications?limit=${PREVIEW_LIMIT}`, { cache: "no-store" });
      const json = await res.json();
      if (json?.success) {
        setItems(json.data.items as NotificationItem[]);
        setUnread(json.data.unread as number);
      }
    } catch {
      /* transient — keep current state */
    }
  }, []);

  // Poll for the unread badge; also refresh whenever the panel opens.
  useEffect(() => {
    load();
    const t = setInterval(load, POLL_MS);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  const markAll = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/notifications/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true }),
      });
      const json = await res.json();
      if (json?.success) {
        setUnread(0);
        setItems((prev) => prev.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })));
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  const onActivate = useCallback((n: NotificationItem) => {
    if (n.read_at) return;
    // Optimistic: mark this one read locally + on the server.
    setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x)));
    setUnread((u) => Math.max(0, u - 1));
    fetch("/api/notifications/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: n.id }),
    }).catch(() => {});
  }, []);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          aria-label={unread > 0 ? `Notificações (${unread} não lidas)` : "Notificações"}
          className="relative p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40"
        >
          <Bell size={18} aria-hidden="true" />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-2.5">
          <span className="text-sm font-bold text-gray-900">Notificações</span>
          {unread > 0 && (
            <button
              type="button"
              onClick={markAll}
              disabled={loading}
              className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700 disabled:opacity-50"
            >
              {loading ? <Loader2 size={12} className="animate-spin" /> : <CheckCheck size={12} />}
              Marcar todas
            </button>
          )}
        </div>

        <div className="max-h-[60vh] overflow-y-auto scrollbar-thin">
          {items.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-gray-400">Sem notificações.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {items.map((n) => (
                <li key={n.id}>
                  <PopoverClose asChild>
                    <div>
                      <NotificationRow n={n} onActivate={onActivate} />
                    </div>
                  </PopoverClose>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="border-t border-gray-100 px-4 py-2 text-center">
          <PopoverClose asChild>
            <Link href="/notifications" className="text-xs font-medium text-brand-600 hover:text-brand-700">
              Ver todas
            </Link>
          </PopoverClose>
        </div>
      </PopoverContent>
    </Popover>
  );
}
