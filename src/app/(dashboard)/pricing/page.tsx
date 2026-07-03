import { BadgeDollarSign } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { PricingShell } from "@/components/pricing/pricing-shell";

export const dynamic = "force-dynamic";

export default async function PricingPage() {
  await requireRole(["admin", "manager"]);
  return (
    <div className="space-y-4 lg:space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-brand-500 flex items-center justify-center">
          <BadgeDollarSign size={16} className="text-white" aria-hidden="true" />
        </div>
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-gray-900">Precificação</h1>
          <p className="text-xs text-gray-500">
            Regras por temporada, dias da semana e feriados — por grupo de anúncios ou imóvel
          </p>
        </div>
      </div>
      <PricingShell />
    </div>
  );
}
