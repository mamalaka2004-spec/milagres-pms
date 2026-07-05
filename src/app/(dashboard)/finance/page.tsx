import { DollarSign } from "lucide-react";
import { requireAuth } from "@/lib/auth";
import { FinanceShell } from "@/components/finance/finance-shell";
import { ReservationsOverview } from "@/components/finance/reservations-overview";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ from?: string; to?: string; tab?: string }>;
}

function defaultRange() {
  const today = new Date();
  const from = new Date(today.getFullYear(), today.getMonth() - 5, 1)
    .toISOString()
    .slice(0, 10);
  const to = new Date(today.getFullYear(), today.getMonth() + 1, 0)
    .toISOString()
    .slice(0, 10);
  return { from, to };
}

export default async function FinancePage({ searchParams }: PageProps) {
  const user = await requireAuth();
  const params = await searchParams;
  const range = {
    from: params.from || defaultRange().from,
    to: params.to || defaultRange().to,
  };

  return (
    <div className="space-y-4 lg:space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-brand-500 flex items-center justify-center">
          <DollarSign size={16} className="text-white" aria-hidden="true" />
        </div>
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-gray-900">Financeiro</h1>
          <p className="text-xs text-gray-500">
            Fluxo de caixa, entradas e saídas, transferências e contas
          </p>
        </div>
      </div>
      <FinanceShell
        initialTab={params.tab}
        overviewSlot={<ReservationsOverview companyId={user.company_id} range={range} />}
      />
    </div>
  );
}
