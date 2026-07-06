import Link from "next/link";
import { Bell, Settings2 } from "lucide-react";
import { requirePageAuth } from "@/lib/auth";
import { listNotifications } from "@/lib/db/queries/notifications";
import { NotificationsList } from "@/components/notifications/notifications-list";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  // requirePageAuth (fora de try/catch) redireciona camareira → /operations.
  const user = await requirePageAuth();
  const { items, unread } = await listNotifications(user.id, { limit: 30 });

  return (
    <div className="space-y-4 lg:space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-brand-500 flex items-center justify-center">
            <Bell size={16} className="text-white" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-xl lg:text-2xl font-bold text-gray-900">Notificações</h1>
            <p className="text-xs text-gray-500">Reservas, mensagens e cancelamentos</p>
          </div>
        </div>
        <Link
          href="/settings/notifications"
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors duration-200 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40"
        >
          <Settings2 size={13} aria-hidden="true" />
          Preferências
        </Link>
      </div>

      <NotificationsList initialItems={items} initialUnread={unread} />
    </div>
  );
}
