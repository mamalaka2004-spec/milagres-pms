import Link from "next/link";
import { MessageSquare, ChevronRight, Settings as SettingsIcon } from "lucide-react";
import { requireAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  await requireAuth();
  return (
    <div className="space-y-4 lg:space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-gray-700 flex items-center justify-center">
          <SettingsIcon size={16} className="text-white" />
        </div>
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-gray-900">Settings</h1>
          <p className="text-xs text-gray-500">Configurações do sistema</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-3xl">
        <Link
          href="/settings/whatsapp"
          className="bg-white border border-gray-200 rounded-xl p-4 hover:border-brand-300 hover:shadow-sm transition group flex items-start gap-3"
        >
          <div className="w-9 h-9 rounded-lg bg-brand-500/10 flex items-center justify-center shrink-0">
            <MessageSquare className="text-brand-600" size={18} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-sm text-gray-900 flex items-center gap-1">
              WhatsApp Lines
              <ChevronRight size={14} className="text-gray-300 group-hover:text-brand-500 transition" />
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              Conectar números, configurar horário comercial e atribuir usuários por linha.
            </p>
          </div>
        </Link>
      </div>
    </div>
  );
}
