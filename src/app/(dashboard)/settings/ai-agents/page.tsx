import Link from "next/link";
import { ChevronLeft, Sparkles } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { AiAgentsShell } from "@/components/settings/ai-agents-shell";

export const dynamic = "force-dynamic";

export default async function SettingsAiAgentsPage() {
  const user = await requireRole(["admin", "manager"]);
  return (
    <div className="space-y-4 lg:space-y-6">
      <Link href="/settings" className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700">
        <ChevronLeft size={14} /> Ajustes
      </Link>
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-500/10">
          <Sparkles size={16} className="text-brand-600" aria-hidden="true" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900 lg:text-2xl">Agentes de IA</h1>
          <p className="text-xs text-gray-500">Prompt, modelo, ferramentas e vínculo por canal — configuração no banco.</p>
        </div>
      </div>
      <AiAgentsShell canEdit={user.role === "admin" || user.role === "manager"} />
    </div>
  );
}
