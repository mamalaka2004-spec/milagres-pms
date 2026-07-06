import Link from "next/link";
import { ChevronLeft, Bell } from "lucide-react";
import { requirePageAuth } from "@/lib/auth";
import { getNotificationPreferences } from "@/lib/db/queries/notifications";
import { NotificationPreferencesShell } from "@/components/settings/notification-preferences-shell";

export const dynamic = "force-dynamic";

export default async function SettingsNotificationsPage() {
  // Preferência pessoal — disponível a qualquer papel exceto camareira (redirect).
  const user = await requirePageAuth();
  const prefs = await getNotificationPreferences(user.id);

  return (
    <div className="space-y-4 lg:space-y-6">
      <Link
        href="/settings"
        className="text-xs text-gray-500 hover:text-gray-800 inline-flex items-center gap-1 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40 rounded"
      >
        <ChevronLeft size={12} aria-hidden="true" /> Ajustes
      </Link>
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-brand-500 flex items-center justify-center">
          <Bell size={16} className="text-white" aria-hidden="true" />
        </div>
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-gray-900">Notificações</h1>
          <p className="text-xs text-gray-500">Escolha quais alertas você quer receber no app</p>
        </div>
      </div>
      <NotificationPreferencesShell initialPrefs={prefs} />
    </div>
  );
}
