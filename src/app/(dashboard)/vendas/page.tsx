import { Target } from "lucide-react";
import { requireAuth } from "@/lib/auth";
import { SalesShell } from "@/components/sales/sales-shell";

export const dynamic = "force-dynamic";

export default async function VendasPage() {
  await requireAuth();

  return (
    <div className="space-y-4 lg:space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-amber-600 flex items-center justify-center">
          <Target size={16} className="text-white" />
        </div>
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-gray-900">Vendas Chat</h1>
          <p className="text-xs text-gray-500">Pipeline de leads · IA Sarah · WhatsApp</p>
        </div>
      </div>
      <SalesShell />
    </div>
  );
}
