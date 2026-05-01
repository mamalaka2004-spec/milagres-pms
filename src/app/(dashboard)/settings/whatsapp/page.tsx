import Link from "next/link";
import { ChevronLeft, MessageSquare } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { WhatsappLinesShell } from "@/components/settings/whatsapp-lines-shell";

export const dynamic = "force-dynamic";

export default async function SettingsWhatsappPage() {
  await requireRole(["admin", "manager"]);
  return (
    <div className="space-y-4 lg:space-y-6">
      <Link href="/settings" className="text-xs text-gray-500 hover:text-gray-800 inline-flex items-center gap-1">
        <ChevronLeft size={12} /> Settings
      </Link>
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-brand-500 flex items-center justify-center">
          <MessageSquare size={16} className="text-white" />
        </div>
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-gray-900">WhatsApp Lines</h1>
          <p className="text-xs text-gray-500">Conectar números, definir horários, atribuir usuários por linha</p>
        </div>
      </div>
      <WhatsappLinesShell />
    </div>
  );
}
