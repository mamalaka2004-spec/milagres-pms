import Link from "next/link";
import { ChevronLeft, ScrollText } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { getActivityLogs, getActivityEntityTypes } from "@/lib/db/queries/activity";
import { ActivityLogList } from "@/components/settings/activity-log-list";

export const dynamic = "force-dynamic";

export default async function SettingsLogsPage() {
  const user = await requireRole(["admin", "manager"]);
  const [initialLogs, entityTypes] = await Promise.all([
    getActivityLogs(user.company_id, { limit: 40 }),
    getActivityEntityTypes(user.company_id),
  ]);

  return (
    <div className="space-y-4 lg:space-y-6">
      <Link
        href="/settings"
        className="inline-flex items-center gap-1 rounded text-xs text-gray-500 transition-colors duration-200 hover:text-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40"
      >
        <ChevronLeft size={12} aria-hidden="true" /> Ajustes
      </Link>
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-700">
          <ScrollText size={16} className="text-white" aria-hidden="true" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900 lg:text-2xl">Atividade</h1>
          <p className="text-xs text-gray-500">Registro de ações da equipe (criação, edição e remoção)</p>
        </div>
      </div>

      <div className="max-w-3xl">
        <ActivityLogList initialLogs={initialLogs} entityTypes={entityTypes} />
      </div>
    </div>
  );
}
