"use client";

// ===========================================================================
// Transações — lista com filtros + lançamento de entrada/saída (dialog).
// "Vencido" é derivado (pendente com vencimento passado), nunca persistido.
// ===========================================================================

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Pencil, Plus, Search, Trash2 } from "lucide-react";
import {
  Badge,
  Button,
  ConfirmDialog,
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui";
import { cn } from "@/lib/utils/cn";
import { api } from "@/lib/chat/utils";
import { toast } from "@/components/ui/use-toast";
import { formatCurrency, formatDate } from "@/lib/utils/format";
import {
  FIN_METHOD_LABELS,
  FIN_RECURRENCE_LABELS,
  FIN_STATUS_LABELS,
  isOverdue,
  type BankAccountWithBalance,
  type CostCenter,
  type FinCategory,
  type FinPaymentMethod,
  type FinRecurrence,
  type FinTransaction,
  type FinTransactionStatus,
  type FinTransactionType,
} from "@/types/finance";
import type { PropertyLite } from "@/components/finance/finance-shell";

const inputClass =
  "w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-400/15";
const labelClass = "block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5";

interface Filters {
  type: "" | FinTransactionType;
  status: "" | FinTransactionStatus;
  from: string;
  to: string;
  bank_account_id: string;
  category_id: string;
  cost_center_id: string;
  q: string;
}

const EMPTY_FILTERS: Filters = {
  type: "",
  status: "",
  from: "",
  to: "",
  bank_account_id: "",
  category_id: "",
  cost_center_id: "",
  q: "",
};

interface TransactionsTabProps {
  accounts: BankAccountWithBalance[];
  costCenters: CostCenter[];
  categories: FinCategory[];
  properties: PropertyLite[];
  /** Notifica o shell (saldos/fluxo) após qualquer mutação. */
  onChanged: () => Promise<void> | void;
}

export function TransactionsTab({
  accounts,
  costCenters,
  categories,
  properties,
  onChanged,
}: TransactionsTabProps) {
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [qInput, setQInput] = useState("");
  const [list, setList] = useState<FinTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<FinTransaction | null>(null);
  const [presetType, setPresetType] = useState<FinTransactionType>("revenue");
  const [deleting, setDeleting] = useState<FinTransaction | null>(null);

  const setFilter = <K extends keyof Filters>(key: K, value: Filters[K]) =>
    setFilters((f) => ({ ...f, [key]: value }));

  // Busca com debounce
  useEffect(() => {
    const t = setTimeout(() => setFilter("q", qInput.trim()), 350);
    return () => clearTimeout(t);
  }, [qInput]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(filters)) {
        if (value) params.set(key, value);
      }
      setList(await api<FinTransaction[]>(`/api/finance/transactions?${params.toString()}`));
    } catch {
      toast({ title: "Erro ao carregar transações", variant: "error" });
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    void load();
  }, [load]);

  const totals = useMemo(() => {
    let inCents = 0;
    let outCents = 0;
    for (const t of list) {
      if (t.status === "canceled") continue;
      if (t.type === "revenue") inCents += t.amount_cents;
      else outCents += t.amount_cents;
    }
    return { inCents, outCents, net: inCents - outCents };
  }, [list]);

  const openNew = (type: FinTransactionType) => {
    setEditing(null);
    setPresetType(type);
    setDialogOpen(true);
  };
  const openEdit = (tx: FinTransaction) => {
    setEditing(tx);
    setDialogOpen(true);
  };

  const remove = async () => {
    if (!deleting) return;
    try {
      await api(`/api/finance/transactions/${deleting.id}`, { method: "DELETE" });
      toast({ title: "Transação excluída" });
      await load();
      await onChanged();
    } catch (e) {
      toast({ title: "Erro ao excluir", description: e instanceof Error ? e.message : "", variant: "error" });
    } finally {
      setDeleting(null);
    }
  };

  const categoryLabel = (tx: FinTransaction): string => {
    if (!tx.category) return "—";
    const parent = tx.category.parent_id
      ? categories.find((c) => c.id === tx.category!.parent_id)
      : null;
    return parent ? `${parent.name} · ${tx.category.name}` : tx.category.name;
  };

  return (
    <div className="space-y-4">
      {/* Ações + totais do filtro */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 text-xs text-gray-500">
          <span>
            Entradas:{" "}
            <strong className="font-mono text-green-700">{formatCurrency(totals.inCents)}</strong>
          </span>
          <span>
            Saídas:{" "}
            <strong className="font-mono text-red-700">{formatCurrency(totals.outCents)}</strong>
          </span>
          <span>
            Saldo:{" "}
            <strong className={cn("font-mono", totals.net < 0 ? "text-red-700" : "text-gray-900")}>
              {formatCurrency(totals.net)}
            </strong>
          </span>
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={() => openNew("revenue")}>
            <Plus size={14} aria-hidden="true" /> Entrada
          </Button>
          <Button size="sm" variant="secondary" onClick={() => openNew("expense")}>
            <Plus size={14} aria-hidden="true" /> Saída
          </Button>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-3 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2">
        <div className="col-span-2 relative">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            aria-hidden="true"
          />
          <input
            value={qInput}
            onChange={(e) => setQInput(e.target.value)}
            placeholder="Buscar descrição/contraparte…"
            className={cn(inputClass, "pl-8")}
            aria-label="Buscar transações"
          />
        </div>
        <select
          value={filters.type}
          onChange={(e) => setFilter("type", e.target.value as Filters["type"])}
          className={cn(inputClass, "bg-white cursor-pointer")}
          aria-label="Tipo"
        >
          <option value="">Tipo: todos</option>
          <option value="revenue">Entradas</option>
          <option value="expense">Saídas</option>
        </select>
        <select
          value={filters.status}
          onChange={(e) => setFilter("status", e.target.value as Filters["status"])}
          className={cn(inputClass, "bg-white cursor-pointer")}
          aria-label="Status"
        >
          <option value="">Status: todos</option>
          <option value="pending">Pendente</option>
          <option value="paid">Pago</option>
          <option value="canceled">Cancelado</option>
        </select>
        <input
          type="date"
          value={filters.from}
          onChange={(e) => setFilter("from", e.target.value)}
          className={inputClass}
          aria-label="De (competência)"
        />
        <input
          type="date"
          value={filters.to}
          onChange={(e) => setFilter("to", e.target.value)}
          className={inputClass}
          aria-label="Até (competência)"
        />
        <select
          value={filters.bank_account_id}
          onChange={(e) => setFilter("bank_account_id", e.target.value)}
          className={cn(inputClass, "bg-white cursor-pointer")}
          aria-label="Conta"
        >
          <option value="">Conta: todas</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
        <select
          value={filters.cost_center_id}
          onChange={(e) => setFilter("cost_center_id", e.target.value)}
          className={cn(inputClass, "bg-white cursor-pointer")}
          aria-label="Centro de custo"
        >
          <option value="">Centro: todos</option>
          {costCenters.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {/* Lista */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-gray-400">
          <Loader2 className="animate-spin" size={20} aria-hidden="true" />
        </div>
      ) : list.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/60 py-12 text-center text-sm text-gray-400">
          Nenhuma transação encontrada. Lance a primeira com <strong>+ Entrada</strong> ou{" "}
          <strong>+ Saída</strong>.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-[11px] uppercase tracking-wider text-gray-400">
                <th className="px-4 py-3 font-semibold">Data</th>
                <th className="px-4 py-3 font-semibold">Descrição</th>
                <th className="px-4 py-3 font-semibold hidden md:table-cell">Categoria</th>
                <th className="px-4 py-3 font-semibold hidden lg:table-cell">Conta</th>
                <th className="px-4 py-3 font-semibold hidden lg:table-cell">Método</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold text-right">Valor</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {list.map((tx) => {
                const overdue = isOverdue(tx);
                return (
                  <tr key={tx.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/60">
                    <td className="px-4 py-3 font-mono text-xs text-gray-600 whitespace-nowrap">
                      {formatDate(tx.date_ref)}
                      {tx.date_due && tx.status === "pending" && (
                        <div className={cn("text-[10px]", overdue ? "text-red-600" : "text-gray-400")}>
                          venc. {formatDate(tx.date_due)}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{tx.description}</div>
                      {(tx.counterparty || tx.property) && (
                        <div className="text-xs text-gray-500">
                          {[tx.counterparty, tx.property?.name].filter(Boolean).join(" · ")}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600 hidden md:table-cell">
                      {categoryLabel(tx)}
                      {tx.cost_center && (
                        <div className="text-[11px] text-gray-400">{tx.cost_center.name}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600 hidden lg:table-cell">
                      {tx.bank_account?.name || "—"}
                    </td>
                    <td className="px-4 py-3 text-gray-600 hidden lg:table-cell">
                      {tx.payment_method ? FIN_METHOD_LABELS[tx.payment_method] : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        tone={
                          overdue
                            ? "danger"
                            : tx.status === "paid"
                            ? "success"
                            : tx.status === "pending"
                            ? "warning"
                            : "neutral"
                        }
                        className="text-[11px]"
                      >
                        {overdue ? "Vencido" : FIN_STATUS_LABELS[tx.status]}
                      </Badge>
                    </td>
                    <td
                      className={cn(
                        "px-4 py-3 text-right font-mono font-semibold whitespace-nowrap",
                        tx.status === "canceled"
                          ? "text-gray-400 line-through"
                          : tx.type === "revenue"
                          ? "text-green-700"
                          : "text-red-700"
                      )}
                    >
                      {tx.type === "revenue" ? "+" : "−"}
                      {formatCurrency(tx.amount_cents)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => openEdit(tx)}
                          className="rounded-md p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
                          aria-label={`Editar ${tx.description}`}
                        >
                          <Pencil size={14} aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleting(tx)}
                          className="rounded-md p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600"
                          aria-label={`Excluir ${tx.description}`}
                        >
                          <Trash2 size={14} aria-hidden="true" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <TransactionDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        transaction={editing}
        presetType={presetType}
        accounts={accounts}
        costCenters={costCenters}
        categories={categories}
        properties={properties}
        onSaved={async () => {
          await load();
          await onChanged();
        }}
      />

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Excluir transação?"
        description={`“${deleting?.description}” será removida e sairá do fluxo de caixa.`}
        confirmLabel="Excluir"
        variant="danger"
        onConfirm={remove}
      />
    </div>
  );
}

// ─── Dialog de transação (criar/editar) ──────────────────────────────────────

interface TxDraft {
  type: FinTransactionType;
  status: FinTransactionStatus;
  description: string;
  amount: string;
  date_ref: string;
  date_due: string;
  date_paid: string;
  counterparty: string;
  category_id: string;
  cost_center_id: string;
  bank_account_id: string;
  payment_method: "" | FinPaymentMethod;
  recurrence: FinRecurrence;
  property_id: string;
  notes: string;
}

function emptyDraft(type: FinTransactionType): TxDraft {
  const today = new Date().toISOString().slice(0, 10);
  return {
    type,
    status: "paid",
    description: "",
    amount: "",
    date_ref: today,
    date_due: "",
    date_paid: today,
    counterparty: "",
    category_id: "",
    cost_center_id: "",
    bank_account_id: "",
    payment_method: "",
    recurrence: "none",
    property_id: "",
    notes: "",
  };
}

function draftFromTx(tx: FinTransaction): TxDraft {
  return {
    type: tx.type,
    status: tx.status,
    description: tx.description,
    amount: String(tx.amount_cents / 100),
    date_ref: tx.date_ref,
    date_due: tx.date_due ?? "",
    date_paid: tx.date_paid ?? "",
    counterparty: tx.counterparty ?? "",
    category_id: tx.category_id ?? "",
    cost_center_id: tx.cost_center_id ?? "",
    bank_account_id: tx.bank_account_id ?? "",
    payment_method: tx.payment_method ?? "",
    recurrence: tx.recurrence,
    property_id: tx.property_id ?? "",
    notes: tx.notes ?? "",
  };
}

interface TransactionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: FinTransaction | null;
  presetType: FinTransactionType;
  accounts: BankAccountWithBalance[];
  costCenters: CostCenter[];
  categories: FinCategory[];
  properties: PropertyLite[];
  onSaved: () => Promise<void> | void;
}

function TransactionDialog({
  open,
  onOpenChange,
  transaction,
  presetType,
  accounts,
  costCenters,
  categories,
  properties,
  onSaved,
}: TransactionDialogProps) {
  const [draft, setDraft] = useState<TxDraft>(emptyDraft("revenue"));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setDraft(transaction ? draftFromTx(transaction) : emptyDraft(presetType));
  }, [open, transaction, presetType]);

  const set = <K extends keyof TxDraft>(key: K, value: TxDraft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const parents = useMemo(
    () => categories.filter((c) => c.type === draft.type && !c.parent_id && c.is_active),
    [categories, draft.type]
  );
  const childrenOf = (parentId: string) =>
    categories.filter((c) => c.parent_id === parentId && c.is_active);

  const save = async () => {
    setSaving(true);
    try {
      const payload = {
        type: draft.type,
        status: draft.status,
        description: draft.description.trim(),
        amount: Number(draft.amount),
        date_ref: draft.date_ref,
        date_due: draft.date_due || null,
        date_paid: draft.status === "paid" ? draft.date_paid || null : null,
        counterparty: draft.counterparty.trim() || null,
        category_id: draft.category_id || null,
        cost_center_id: draft.cost_center_id || null,
        bank_account_id: draft.bank_account_id || null,
        payment_method: draft.payment_method || null,
        recurrence: draft.recurrence,
        property_id: draft.property_id || null,
        notes: draft.notes.trim() || null,
      };
      if (transaction) {
        await api(`/api/finance/transactions/${transaction.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        await api("/api/finance/transactions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }
      toast({ title: transaction ? "Transação atualizada" : "Transação lançada" });
      onOpenChange(false);
      await onSaved();
    } catch (e) {
      toast({ title: "Erro ao salvar", description: e instanceof Error ? e.message : "", variant: "error" });
    } finally {
      setSaving(false);
    }
  };

  const canSave = draft.description.trim() && Number(draft.amount) > 0 && draft.date_ref;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {transaction
              ? "Editar transação"
              : draft.type === "revenue"
              ? "Nova entrada"
              : "Nova saída"}
          </DialogTitle>
        </DialogHeader>
        <DialogBody className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Tipo *</label>
              <select
                value={draft.type}
                onChange={(e) => {
                  const type = e.target.value as FinTransactionType;
                  setDraft((d) => ({ ...d, type, category_id: "" }));
                }}
                className={cn(inputClass, "bg-white cursor-pointer")}
              >
                <option value="revenue">Entrada (receita)</option>
                <option value="expense">Saída (despesa)</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Status *</label>
              <select
                value={draft.status}
                onChange={(e) => set("status", e.target.value as FinTransactionStatus)}
                className={cn(inputClass, "bg-white cursor-pointer")}
              >
                <option value="paid">Pago</option>
                <option value="pending">Pendente</option>
                <option value="canceled">Cancelado</option>
              </select>
            </div>
          </div>

          <div>
            <label className={labelClass}>Descrição *</label>
            <input
              value={draft.description}
              onChange={(e) => set("description", e.target.value)}
              placeholder={
                draft.type === "revenue" ? "Ex.: Aluguel temporada casa 3" : "Ex.: Conta de luz"
              }
              className={inputClass}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Valor (R$) *</label>
              <input
                type="number"
                step="0.01"
                min={0}
                value={draft.amount}
                onChange={(e) => set("amount", e.target.value)}
                className={cn(inputClass, "font-mono")}
              />
            </div>
            <div>
              <label className={labelClass}>
                {draft.type === "revenue" ? "Cliente" : "Fornecedor"}
              </label>
              <input
                value={draft.counterparty}
                onChange={(e) => set("counterparty", e.target.value)}
                placeholder="Opcional"
                className={inputClass}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelClass}>Competência *</label>
              <input
                type="date"
                value={draft.date_ref}
                onChange={(e) => set("date_ref", e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Vencimento</label>
              <input
                type="date"
                value={draft.date_due}
                onChange={(e) => set("date_due", e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Pagamento</label>
              <input
                type="date"
                value={draft.date_paid}
                onChange={(e) => set("date_paid", e.target.value)}
                disabled={draft.status !== "paid"}
                className={cn(inputClass, draft.status !== "paid" && "opacity-50")}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Categoria</label>
              <select
                value={draft.category_id}
                onChange={(e) => set("category_id", e.target.value)}
                className={cn(inputClass, "bg-white cursor-pointer")}
              >
                <option value="">Sem categoria</option>
                {parents.map((p) => {
                  const children = childrenOf(p.id);
                  return (
                    <optgroup key={p.id} label={p.name}>
                      <option value={p.id}>{p.name} (geral)</option>
                      {children.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </optgroup>
                  );
                })}
              </select>
            </div>
            <div>
              <label className={labelClass}>Centro de custo</label>
              <select
                value={draft.cost_center_id}
                onChange={(e) => set("cost_center_id", e.target.value)}
                className={cn(inputClass, "bg-white cursor-pointer")}
              >
                <option value="">Sem centro</option>
                {costCenters
                  .filter((c) => c.is_active)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelClass}>Conta</label>
              <select
                value={draft.bank_account_id}
                onChange={(e) => set("bank_account_id", e.target.value)}
                className={cn(inputClass, "bg-white cursor-pointer")}
              >
                <option value="">Sem conta</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Método</label>
              <select
                value={draft.payment_method}
                onChange={(e) => set("payment_method", e.target.value as TxDraft["payment_method"])}
                className={cn(inputClass, "bg-white cursor-pointer")}
              >
                <option value="">—</option>
                {Object.entries(FIN_METHOD_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Recorrência</label>
              <select
                value={draft.recurrence}
                onChange={(e) => set("recurrence", e.target.value as FinRecurrence)}
                className={cn(inputClass, "bg-white cursor-pointer")}
              >
                {Object.entries(FIN_RECURRENCE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Imóvel</label>
              <select
                value={draft.property_id}
                onChange={(e) => set("property_id", e.target.value)}
                className={cn(inputClass, "bg-white cursor-pointer")}
              >
                <option value="">Sem vínculo</option>
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Observações</label>
              <input
                value={draft.notes}
                onChange={(e) => set("notes", e.target.value)}
                placeholder="Opcional"
                className={inputClass}
              />
            </div>
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={save} loading={saving} disabled={saving || !canSave}>
            {transaction ? "Salvar" : "Lançar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
