"use client";

// ===========================================================================
// Financeiro — shell com abas (Fase 5)
//   Fluxo de Caixa · Transações · Transferências · Cadastros · Reservas
// A aba Reservas renderiza o slot server-rendered (visão anterior preservada).
// ===========================================================================

import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  ArrowDownUp,
  ArrowLeftRight,
  BedDouble,
  Landmark,
  Loader2,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { api } from "@/lib/chat/utils";
import { toast } from "@/components/ui/use-toast";
import type { BankAccountWithBalance, CostCenter, FinCategory } from "@/types/finance";
import { CashFlowTab } from "@/components/finance/cashflow-tab";
import { TransactionsTab } from "@/components/finance/transactions-tab";
import { TransfersTab } from "@/components/finance/transfers-tab";
import { RegistryTab } from "@/components/finance/registry-tab";

export interface PropertyLite {
  id: string;
  name: string;
}

type TabId = "fluxo" | "transacoes" | "transferencias" | "cadastros" | "reservas";

const TABS: Array<{ id: TabId; label: string; icon: typeof Wallet }> = [
  { id: "fluxo", label: "Fluxo de Caixa", icon: Wallet },
  { id: "transacoes", label: "Transações", icon: ArrowDownUp },
  { id: "transferencias", label: "Transferências", icon: ArrowLeftRight },
  { id: "cadastros", label: "Cadastros", icon: Landmark },
  { id: "reservas", label: "Reservas & Pagamentos", icon: BedDouble },
];

interface FinanceShellProps {
  /** Conteúdo server-rendered da visão de reservas/pagamentos. */
  overviewSlot: ReactNode;
  initialTab?: string;
}

export function FinanceShell({ overviewSlot, initialTab }: FinanceShellProps) {
  const [tab, setTab] = useState<TabId>(
    TABS.some((t) => t.id === initialTab) ? (initialTab as TabId) : "fluxo"
  );
  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState<BankAccountWithBalance[]>([]);
  const [costCenters, setCostCenters] = useState<CostCenter[]>([]);
  const [categories, setCategories] = useState<FinCategory[]>([]);
  const [properties, setProperties] = useState<PropertyLite[]>([]);
  /** Incrementado a cada mutação para o fluxo de caixa recarregar. */
  const [flowVersion, setFlowVersion] = useState(0);

  const loadAccounts = useCallback(async () => {
    setAccounts(await api<BankAccountWithBalance[]>("/api/finance/accounts"));
  }, []);
  const loadCostCenters = useCallback(async () => {
    setCostCenters(await api<CostCenter[]>("/api/finance/cost-centers"));
  }, []);
  const loadCategories = useCallback(async () => {
    setCategories(await api<FinCategory[]>("/api/finance/categories"));
  }, []);

  const bumpFlow = useCallback(async () => {
    setFlowVersion((v) => v + 1);
    await loadAccounts();
  }, [loadAccounts]);

  useEffect(() => {
    Promise.all([
      loadAccounts(),
      loadCostCenters(),
      loadCategories(),
      api<Array<PropertyLite & Record<string, unknown>>>("/api/properties").then((list) =>
        setProperties(list.map((p) => ({ id: p.id, name: p.name })))
      ),
    ])
      .catch(() => toast({ title: "Erro ao carregar o financeiro", variant: "error" }))
      .finally(() => setLoading(false));
  }, [loadAccounts, loadCostCenters, loadCategories]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-gray-400">
        <Loader2 className="animate-spin" size={20} aria-hidden="true" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Abas */}
      <div className="flex gap-1 overflow-x-auto rounded-lg border border-gray-200 bg-gray-50 p-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "flex shrink-0 items-center gap-2 rounded-md px-3.5 py-1.5 text-sm font-medium transition-colors",
              tab === t.id ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
            )}
          >
            <t.icon size={14} aria-hidden="true" />
            {t.label}
          </button>
        ))}
      </div>

      {tab === "fluxo" && <CashFlowTab reloadKey={flowVersion} />}
      {tab === "transacoes" && (
        <TransactionsTab
          accounts={accounts}
          costCenters={costCenters}
          categories={categories}
          properties={properties}
          onChanged={bumpFlow}
        />
      )}
      {tab === "transferencias" && <TransfersTab accounts={accounts} onChanged={bumpFlow} />}
      {tab === "cadastros" && (
        <RegistryTab
          accounts={accounts}
          costCenters={costCenters}
          categories={categories}
          onAccountsChanged={loadAccounts}
          onCostCentersChanged={loadCostCenters}
          onCategoriesChanged={loadCategories}
        />
      )}
      {tab === "reservas" && <div className="space-y-4 lg:space-y-6">{overviewSlot}</div>}
    </div>
  );
}
