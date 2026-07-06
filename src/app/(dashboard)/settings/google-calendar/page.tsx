import Link from "next/link";
import { ChevronLeft, CalendarClock } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { getProperties } from "@/lib/db/queries/properties";
import { listConnections, isGoogleCalendarConfigured } from "@/lib/calendar/google";
import GoogleCalendarShell from "@/components/settings/google-calendar-shell";

export const dynamic = "force-dynamic";

export default async function SettingsGoogleCalendarPage() {
  const user = await requireRole(["admin", "manager"]);

  const [properties, connections] = await Promise.all([
    getProperties(user.company_id),
    listConnections(user.company_id),
  ]);

  return (
    <div className="space-y-4 lg:space-y-6">
      <Link
        href="/settings"
        className="text-xs text-gray-500 hover:text-gray-800 inline-flex items-center gap-1 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40 rounded"
      >
        <ChevronLeft size={12} aria-hidden="true" /> Ajustes
      </Link>
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-brand-500/10 flex items-center justify-center">
          <CalendarClock size={16} className="text-brand-600" aria-hidden="true" />
        </div>
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-gray-900">Google Calendar</h1>
          <p className="text-xs text-gray-500">Sincronização bidirecional por anúncio</p>
        </div>
      </div>
      <GoogleCalendarShell
        configured={isGoogleCalendarConfigured()}
        properties={properties.map((p) => ({ id: p.id, name: p.name, code: p.code }))}
        connections={connections}
      />
    </div>
  );
}
