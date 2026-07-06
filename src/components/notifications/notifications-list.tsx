"use client";

import { useCallback, useState } from "react";
import { Bell, CheckCheck, Loader2 } from "lucide-react";
import { NotificationRow } from "@/components/notifications/shared";
import type { NotificationItem } from "@/lib/db/queries/notifications";

const PAGE_SIZE = 30;

export function NotificationsList({
  initialItems,
  initialUnread,
}: {
  initialItems: NotificationItem[];
  initialUnread: number;
}) {
  const [items, setItems] = useState<NotificationItem[]>(initialItems);
  const [unread, setUnread] = useState(initialUnread);
  const [loading, setLoading] = useState(false);
  const [marking, setMarking] = useState(false);
  const [done, setDone] = useState(initialItems.length < PAGE_SIZE);

  const loadMore = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: String(PAGE_SIZE) });
      if (items.length > 0) params.set("before", items[items.length - 1].created_at);
      const res = await fetch(`/api/notifications?${params}`, { cache: "no-store" });
      const json = await res.json();
      const next: NotificationItem[] = json?.success ? json.data.items : [];
      setItems((prev) => [...prev, ...next]);
      setDone(next.length < PAGE_SIZE);
    } catch {
      /* transient */
    } finally {
      setLoading(false);
    }
  }, [items]);

  const markAll = useCallback(async () => {
    setMarking(true);
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
      setMarking(false);
    }
  }, []);

  const onActivate = useCallback((n: NotificationItem) => {
    if (n.read_at) return;
    setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x)));
    setUnread((u) => Math.max(0, u - 1));
    fetch("/api/notifications/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: n.id }),
    }).catch(() => {});
  }, []);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          {unread > 0 ? `${unread} não lida${unread > 1 ? "s" : ""}` : "Tudo em dia"}
        </p>
        {unread > 0 && (
          <button
            type="button"
            onClick={markAll}
            disabled={marking}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors duration-200 hover:bg-gray-50 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40"
          >
            {marking ? <Loader2 size={13} className="animate-spin" /> : <CheckCheck size={13} />}
            Marcar todas como lidas
          </button>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        {items.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-16 text-center">
            <Bell size={28} className="text-gray-300" aria-hidden="true" />
            <p className="text-sm text-gray-400">Nenhuma notificação ainda.</p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {items.map((n) => (
              <li key={n.id}>
                <NotificationRow n={n} onActivate={onActivate} />
              </li>
            ))}
          </ul>
        )}
      </div>

      {!done && items.length > 0 && (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={loadMore}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors duration-200 hover:bg-gray-50 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40"
          >
            {loading && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
            {loading ? "Carregando…" : "Carregar mais"}
          </button>
        </div>
      )}
    </div>
  );
}
