"use client";

// ===========================================================================
// Transferências entre contas — lista + nova transferência (dialog).
// ===========================================================================

import { useCallback, useEffect, useState } from "react";
import { ArrowRight, Loader2, Plus, Trash2 } from "lucide-react";
import {
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
import type { BankAccountWithBalance, FinTransfer } from "@/types/finance";

const inputClass =
  "w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-400/15";
const labelClass = "block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5";

interface TransfersTabProps {
  accounts: BankAccountWithBalance[];
  onChanged: () => Promise<void> | void;
}

export function TransfersTab({ accounts, onChanged }: TransfersTabProps) {
  const [list, setList] = useState<FinTransfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState<FinTransfer | null>(null);

  const load = useCallback(async () => {
    try {
      setList(await api<FinTransfer[]>("/api/finance/transfers"));
    } catch {
      toast({ title: "Erro ao carregar transferências", variant: "error" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const remove = async () => {
    if (!deleting) return;
    try {
      await api(`/api/finance/transfers/${deleting.id}`, { method: "DELETE" });
      toast({ title: "Transferência excluída" });
      await load();
      await onChanged();
    } catch (e) {
      toast({ title: "Erro ao excluir", description: e instanceof Error ? e.message : "", variant: "error" });
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-gray-500 max-w-xl">
          Movimentações entre suas contas — não entram como receita/despesa, apenas
          atualizam os saldos.
        </p>
        <Button size="sm" onClick={() => setDialogOpen(true)} disabled={accounts.length < 2}>
          <Plus size={14} aria-hidden="true" /> Nova transferência
        </Button>
      </div>

      {accounts.length < 2 && (
        <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/60 py-8 text-center text-sm text-gray-400">
          Cadastre ao menos duas contas na aba <strong>Cadastros</strong> para transferir entre elas.
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16 text-gray-400">
          <Loader2 className="animate-spin" size={20} aria-hidden="true" />
        </div>
      ) : list.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-[11px] uppercase tracking-wider text-gray-400">
                <th className="px-4 py-3 font-semibold">Data</th>
                <th className="px-4 py-3 font-semibold">Origem → Destino</th>
                <th className="px-4 py-3 font-semibold hidden md:table-cell">Descrição</th>
                <th className="px-4 py-3 font-semibold text-right">Valor</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {list.map((tr) => (
                <tr key={tr.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/60">
                  <td className="px-4 py-3 font-mono text-xs text-gray-600 whitespace-nowrap">
                    {formatDate(tr.date)}
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1.5 font-medium text-gray-900">
                      {tr.from_account?.name || "—"}
                      <ArrowRight size={13} className="text-gray-400" aria-hidden="true" />
                      {tr.to_account?.name || "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600 hidden md:table-cell">
                    {tr.description || "—"}
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-semibold text-gray-900 whitespace-nowrap">
                    {formatCurrency(tr.amount_cents)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => setDeleting(tr)}
                        className="rounded-md p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600"
                        aria-label="Excluir transferência"
                      >
                        <Trash2 size={14} aria-hidden="true" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : accounts.length >= 2 ? (
        <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/60 py-12 text-center text-sm text-gray-400">
          Nenhuma transferência ainda.
        </div>
      ) : null}

      <TransferDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        accounts={accounts}
        onSaved={async () => {
          await load();
          await onChanged();
        }}
      />

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Excluir transferência?"
        description="Os saldos das duas contas serão recalculados sem essa movimentação."
        confirmLabel="Excluir"
        variant="danger"
        onConfirm={remove}
      />
    </div>
  );
}

// ─── Dialog de transferência ─────────────────────────────────────────────────

interface TransferDraft {
  from_account_id: string;
  to_account_id: string;
  amount: string;
  date: string;
  description: string;
}

function emptyTransfer(): TransferDraft {
  return {
    from_account_id: "",
    to_account_id: "",
    amount: "",
    date: new Date().toISOString().slice(0, 10),
    description: "",
  };
}

interface TransferDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accounts: BankAccountWithBalance[];
  onSaved: () => Promise<void> | void;
}

function TransferDialog({ open, onOpenChange, accounts, onSaved }: TransferDialogProps) {
  const [draft, setDraft] = useState<TransferDraft>(emptyTransfer());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setDraft(emptyTransfer());
  }, [open]);

  const set = <K extends keyof TransferDraft>(key: K, value: TransferDraft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const canSave =
    draft.from_account_id &&
    draft.to_account_id &&
    draft.from_account_id !== draft.to_account_id &&
    Number(draft.amount) > 0 &&
    draft.date;

  const save = async () => {
    setSaving(true);
    try {
      await api("/api/finance/transfers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          from_account_id: draft.from_account_id,
          to_account_id: draft.to_account_id,
          amount: Number(draft.amount),
          date: draft.date,
          description: draft.description.trim(),
        }),
      });
      toast({ title: "Transferência registrada" });
      onOpenChange(false);
      await onSaved();
    } catch (e) {
      toast({ title: "Erro ao salvar", description: e instanceof Error ? e.message : "", variant: "error" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nova transferência</DialogTitle>
        </DialogHeader>
        <DialogBody className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>De *</label>
              <select
                value={draft.from_account_id}
                onChange={(e) => set("from_account_id", e.target.value)}
                className={cn(inputClass, "bg-white cursor-pointer")}
              >
                <option value="">Selecione…</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id} disabled={a.id === draft.to_account_id}>
                    {a.name} ({formatCurrency(a.current_balance_cents)})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Para *</label>
              <select
                value={draft.to_account_id}
                onChange={(e) => set("to_account_id", e.target.value)}
                className={cn(inputClass, "bg-white cursor-pointer")}
              >
                <option value="">Selecione…</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id} disabled={a.id === draft.from_account_id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
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
              <label className={labelClass}>Data *</label>
              <input
                type="date"
                value={draft.date}
                onChange={(e) => set("date", e.target.value)}
                className={inputClass}
              />
            </div>
          </div>
          <div>
            <label className={labelClass}>Descrição</label>
            <input
              value={draft.description}
              onChange={(e) => set("description", e.target.value)}
              placeholder="Ex.: Aporte para conta de despesas"
              className={inputClass}
            />
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={save} loading={saving} disabled={saving || !canSave}>
            Transferir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
