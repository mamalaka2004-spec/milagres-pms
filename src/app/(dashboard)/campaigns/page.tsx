import { Megaphone } from "lucide-react";
import { requireAuth } from "@/lib/auth";
import { CampaignsShell } from "@/components/campaigns/campaigns-shell";

export const dynamic = "force-dynamic";

export default async function CampaignsPage() {
  await requireAuth();
  return (
    <div className="space-y-4 lg:space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-brand-500 flex items-center justify-center">
          <Megaphone size={16} className="text-white" aria-hidden="true" />
        </div>
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-gray-900">Campanhas</h1>
          <p className="text-xs text-gray-500">
            Disparo em massa no WhatsApp e prospecção cruzando as bases de Locação e Vendas
          </p>
        </div>
      </div>
      <CampaignsShell />
    </div>
  );
}
