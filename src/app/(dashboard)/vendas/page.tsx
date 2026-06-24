import { Target } from "lucide-react";
import { requireAuth } from "@/lib/auth";
import { SalesShell } from "@/components/sales/sales-shell";

export const dynamic = "force-dynamic";

export default async function VendasPage() {
  await requireAuth();

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-amber-600 flex items-center justify-center shrink-0">
          <Target size={16} className="text-white" aria-hidden="true" />
        </div>
        <div>
          <h1 className="text-lg lg:text-xl font-bold text-gray-900 leading-tight">Chat Vendas</h1>
          <p className="text-xs text-gray-500">Pipeline de leads · IA Sarah · WhatsApp</p>
        </div>
      </div>
      <SalesShell />
    </div>
  );
}
