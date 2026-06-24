import Link from "next/link";
import { ChevronLeft, Users as UsersIcon } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { UsersShell } from "@/components/settings/users-shell";

export const dynamic = "force-dynamic";

export default async function SettingsUsersPage() {
  const user = await requireRole(["admin", "manager"]);
  return (
    <div className="space-y-4 lg:space-y-6">
      <Link href="/settings" className="text-xs text-gray-500 hover:text-gray-800 inline-flex items-center gap-1 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40 rounded">
        <ChevronLeft size={12} aria-hidden="true" /> Ajustes
      </Link>
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-gray-700 flex items-center justify-center">
          <UsersIcon size={16} className="text-white" aria-hidden="true" />
        </div>
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-gray-900">Usuários & permissões</h1>
          <p className="text-xs text-gray-500">Equipe, papéis e acessos do sistema</p>
        </div>
      </div>
      <UsersShell canManage={user.role === "admin"} currentUserId={user.id} />
    </div>
  );
}
