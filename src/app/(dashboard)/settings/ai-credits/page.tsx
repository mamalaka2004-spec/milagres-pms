import Link from "next/link";
import { ChevronLeft, Coins } from "lucide-react";
import { requireAuth } from "@/lib/auth";
import AiCreditsShell from "@/components/settings/ai-credits-shell";

export const dynamic = "force-dynamic";

export default async function SettingsAiCreditsPage() {
  const user = await requireAuth();
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
          <Coins size={16} className="text-brand-600" aria-hidden="true" />
        </div>
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-gray-900">Créditos de IA</h1>
          <p className="text-xs text-gray-500">Saldo, consumo por chamada e recargas</p>
        </div>
      </div>
      <AiCreditsShell canEdit={user.role === "admin"} />
    </div>
  );
}
