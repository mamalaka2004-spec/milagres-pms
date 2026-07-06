"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import {
  NOTIFICATION_TYPES,
  NOTIFICATION_TYPE_META,
  type NotificationType,
} from "@/lib/notifications/types";

type Prefs = Record<NotificationType, boolean>;

export function NotificationPreferencesShell({ initialPrefs }: { initialPrefs: Prefs }) {
  const [prefs, setPrefs] = useState<Prefs>(initialPrefs);
  const [pending, setPending] = useState<NotificationType | null>(null);
  const [error, setError] = useState("");

  const toggle = async (type: NotificationType) => {
    const next = !prefs[type];
    setPrefs((p) => ({ ...p, [type]: next })); // optimistic
    setPending(type);
    setError("");
    try {
      const res = await fetch("/api/notifications/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, in_app: next }),
      });
      const json = await res.json();
      if (!json?.success) throw new Error(json?.error || "Falha ao salvar");
      setPrefs(json.data as Prefs);
    } catch (e) {
      setPrefs((p) => ({ ...p, [type]: !next })); // rollback
      setError(e instanceof Error ? e.message : "Falha ao salvar preferência");
    } finally {
      setPending(null);
    }
  };

  return (
    <div className="max-w-2xl space-y-3">
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <ul className="divide-y divide-gray-100">
          {NOTIFICATION_TYPES.map((type) => {
            const meta = NOTIFICATION_TYPE_META[type];
            const on = prefs[type];
            const busy = pending === type;
            return (
              <li key={type} className="flex items-center justify-between gap-4 px-4 py-3.5">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900">{meta.label}</p>
                  <p className="text-xs text-gray-500">{meta.description}</p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={on}
                  aria-label={meta.label}
                  disabled={busy}
                  onClick={() => toggle(type)}
                  className={cn(
                    "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40 disabled:opacity-60",
                    on ? "bg-brand-500" : "bg-gray-200"
                  )}
                >
                  <span
                    className={cn(
                      "inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform duration-200",
                      on ? "translate-x-5" : "translate-x-0.5"
                    )}
                  />
                  {busy && (
                    <Loader2 size={11} className="absolute -right-5 animate-spin text-gray-400" aria-hidden="true" />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
      <p className="text-xs text-gray-400">
        As notificações aparecem no sino do topo e na tela de Notificações. Preferências valem só para você.
      </p>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
