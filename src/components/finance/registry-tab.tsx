"use client";

// ===========================================================================
// Cadastros do financeiro — contas bancárias, centros de custo e categorias
// (hierarquia pai/filho). Pergunta da fase resolvida aqui: o usuário cadastra
// as próprias contas e centros; categorias vêm semeadas pela migration 027.
// ===========================================================================

import { useEffect, useMemo, useState } from "react";
import { CornerDownRight, Pencil, Plus, Trash2 } from "lucide-react";
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
  Section,
} from "@/components/ui";
import { cn } from "@/lib/utils/cn";
import { api } from "@/lib/chat/utils";
import { toast } from "@/components/ui/use-toast";
import { formatCurrency } from "@/lib/utils/format";
import {
  BANK_ACCOUNT_TYPE_LABELS,
  FIN_TYPE_LABELS,
  type BankAccountType,
  type BankAccountWithBalance,
  type CostCenter,
  type FinCategory,
  type FinTransactionType,
} from "@/types/finance";

const inputClass =
  "w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-400/15";
const labelClass = "block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5";

interface RegistryTabProps {
  accounts: BankAccountWithBalance[];
  costCenters: CostCenter[];
  categories: FinCategory[];
  onAccountsChanged: () => Promise<void> | void;
  onCostCentersChanged: () => Promise<void> | void;
  onCategoriesChanged: () => Promise<void> | void;
}

export function RegistryTab({
  accounts,
  costCenters,
  categories,
  onAccountsChanged,
  onCostCentersChanged,
  onCategoriesChanged,
}: RegistryTabProps) {
  return (
    <div className="space-y-5">
      <AccountsSection accounts={accounts} onChanged={onAccountsChanged} />
      <CostCentersSection costCenters={costCenters} onChanged={onCostCentersChanged} />
      <CategoriesSection categories={categories} onChanged={onCategoriesChanged} />
    </div>
  );
}

// ─── Contas bancárias ────────────────────────────────────────────────────────

interface AccountDraft {
  name: string;
  type: BankAccountType;
  opening_balance: string;
  opening_balance_date: string;
  is_active: boolean;
}

const EMPTY_ACCOUNT: AccountDraft = {
  name: "",
  type: "corrente",
  opening_balance: "0",
  opening_balance_date: "",
  is_active: true,
};

function AccountsSection({
  accounts,
  onChanged,
}: {
  accounts: BankAccountWithBalance[];
  onChanged: () => Promise<void> | void;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<BankAccountWithBalance | null>(null);
  const [deleting, setDeleting] = useState<BankAccountWithBalance | null>(null);
  const [draft, setDraft] = useState<AccountDraft>(EMPTY_ACCOUNT);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (dialogOpen) {
      setDraft(
        editing
          ? {
              name: editing.name,
              type: editing.type,
              opening_balance: String(editing.opening_balance_cents / 100),
              opening_balance_date: editing.opening_balance_date ?? "",
              is_active: editing.is_active,
            }
          : EMPTY_ACCOUNT
      );
    }
  }, [dialogOpen, editing]);

  const set = <K extends keyof AccountDraft>(key: K, value: AccountDraft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const save = async () => {
    setSaving(true);
    try {
      const payload = {
        name: draft.name.trim(),
        type: draft.type,
        opening_balance: Number(draft.opening_balance) || 0,
        opening_balance_date: draft.opening_balance_date || null,
        is_active: draft.is_active,
      };
      if (editing) {
        await api(`/api/finance/accounts/${editing.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        await api("/api/finance/accounts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }
      toast({ title: editing ? "Conta atualizada" : "Conta criada" });
      setDialogOpen(false);
      await onChanged();
    } catch (e) {
      toast({ title: "Erro ao salvar", description: e instanceof Error ? e.message : "", variant: "error" });
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!deleting) return;
    try {
      await api(`/api/finance/accounts/${deleting.id}`, { method: "DELETE" });
      toast({ title: "Conta excluída" });
      await onChanged();
    } catch (e) {
      toast({ title: "Erro ao excluir", description: e instanceof Error ? e.message : "", variant: "error" });
    } finally {
      setDeleting(null);
    }
  };

  return (
    <Section
      title="Contas bancárias"
      description="O saldo atual = saldo inicial + transações pagas na conta ± transferências."
      actions={
        <Button
          size="sm"
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
        >
          <Plus size={14} aria-hidden="true" /> Nova conta
        </Button>
      }
    >
      {accounts.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/60 py-8 text-center text-sm text-gray-400">
          Nenhuma conta ainda. Ex.: “Banco do Brasil PJ”, “Caixa da pousada”.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-[11px] uppercase tracking-wider text-gray-400">
                <th className="px-3 py-2 font-semibold">Conta</th>
                <th className="px-3 py-2 font-semibold hidden md:table-cell">Tipo</th>
                <th className="px-3 py-2 font-semibold text-right">Saldo inicial</th>
                <th className="px-3 py-2 font-semibold text-right">Saldo atual</th>
                <th className="px-3 py-2 font-semibold">Status</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {accounts.map((a) => (
                <tr key={a.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/60">
                  <td className="px-3 py-2.5 font-medium text-gray-900">{a.name}</td>
                  <td className="px-3 py-2.5 text-gray-600 hidden md:table-cell">
                    {BANK_ACCOUNT_TYPE_LABELS[a.type]}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-gray-600">
                    {formatCurrency(a.opening_balance_cents)}
                  </td>
                  <td
                    className={cn(
                      "px-3 py-2.5 text-right font-mono font-semibold",
                      a.current_balance_cents < 0 ? "text-red-700" : "text-gray-900"
                    )}
                  >
                    {formatCurrency(a.current_balance_cents)}
                  </td>
                  <td className="px-3 py-2.5">
                    <Badge tone={a.is_active ? "success" : "neutral"} className="text-[11px]">
                      {a.is_active ? "Ativa" : "Inativa"}
                    </Badge>
                  </td>
                  <td className="px-3 py-2.5">
                    <RowActions
                      name={a.name}
                      onEdit={() => {
                        setEditing(a);
                        setDialogOpen(true);
                      }}
                      onDelete={() => setDeleting(a)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar conta" : "Nova conta"}</DialogTitle>
          </DialogHeader>
          <DialogBody className="space-y-4">
            <div>
              <label className={labelClass}>Nome *</label>
              <input
                value={draft.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder="Ex.: Banco do Brasil PJ"
                className={inputClass}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Tipo *</label>
                <select
                  value={draft.type}
                  onChange={(e) => set("type", e.target.value as BankAccountType)}
                  className={cn(inputClass, "bg-white cursor-pointer")}
                >
                  {Object.entries(BANK_ACCOUNT_TYPE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-end pb-1">
                <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={draft.is_active}
                    onChange={(e) => set("is_active", e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-brand-500 focus:ring-brand-400"
                  />
                  Ativa
                </label>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Saldo inicial (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  value={draft.opening_balance}
                  onChange={(e) => set("opening_balance", e.target.value)}
                  className={cn(inputClass, "font-mono")}
                />
              </div>
              <div>
                <label className={labelClass}>Data do saldo</label>
                <input
                  type="date"
                  value={draft.opening_balance_date}
                  onChange={(e) => set("opening_balance_date", e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={save} loading={saving} disabled={saving || !draft.name.trim()}>
              {editing ? "Salvar" : "Criar conta"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Excluir conta?"
        description={`“${deleting?.name}” será removida. Transações vinculadas ficam sem conta; transferências dela serão apagadas.`}
        confirmLabel="Excluir"
        variant="danger"
        onConfirm={remove}
      />
    </Section>
  );
}

// ─── Centros de custo ────────────────────────────────────────────────────────

function CostCentersSection({
  costCenters,
  onChanged,
}: {
  costCenters: CostCenter[];
  onChanged: () => Promise<void> | void;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CostCenter | null>(null);
  const [deleting, setDeleting] = useState<CostCenter | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (dialogOpen) {
      setName(editing?.name ?? "");
      setDescription(editing?.description ?? "");
      setIsActive(editing?.is_active ?? true);
    }
  }, [dialogOpen, editing]);

  const save = async () => {
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        description: description.trim() || null,
        is_active: isActive,
      };
      if (editing) {
        await api(`/api/finance/cost-centers/${editing.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        await api("/api/finance/cost-centers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }
      toast({ title: editing ? "Centro atualizado" : "Centro criado" });
      setDialogOpen(false);
      await onChanged();
    } catch (e) {
      toast({ title: "Erro ao salvar", description: e instanceof Error ? e.message : "", variant: "error" });
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!deleting) return;
    try {
      await api(`/api/finance/cost-centers/${deleting.id}`, { method: "DELETE" });
      toast({ title: "Centro de custo excluído" });
      await onChanged();
    } catch (e) {
      toast({ title: "Erro ao excluir", description: e instanceof Error ? e.message : "", variant: "error" });
    } finally {
      setDeleting(null);
    }
  };

  return (
    <Section
      title="Centros de custo"
      description="Agrupe lançamentos por área — ex.: por pousada, administração, obras."
      actions={
        <Button
          size="sm"
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
        >
          <Plus size={14} aria-hidden="true" /> Novo centro
        </Button>
      }
    >
      {costCenters.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/60 py-8 text-center text-sm text-gray-400">
          Nenhum centro de custo ainda. Ex.: “Pousada Milagres”, “Administrativo”.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
          {costCenters.map((c) => (
            <div
              key={c.id}
              className={cn(
                "flex items-start justify-between gap-2 rounded-lg border border-gray-100 bg-gray-50/40 px-3 py-2.5",
                !c.is_active && "opacity-60"
              )}
            >
              <div className="min-w-0">
                <div className="text-sm font-medium text-gray-900 truncate">
                  {c.name}
                  {!c.is_active && <span className="ml-1 text-[10px] text-gray-400">(inativo)</span>}
                </div>
                {c.description && (
                  <div className="text-xs text-gray-500 truncate">{c.description}</div>
                )}
              </div>
              <RowActions
                name={c.name}
                onEdit={() => {
                  setEditing(c);
                  setDialogOpen(true);
                }}
                onDelete={() => setDeleting(c)}
              />
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar centro de custo" : "Novo centro de custo"}</DialogTitle>
          </DialogHeader>
          <DialogBody className="space-y-4">
            <div>
              <label className={labelClass}>Nome *</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex.: Pousada Milagres"
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Descrição</label>
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Opcional"
                className={inputClass}
              />
            </div>
            <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-brand-500 focus:ring-brand-400"
              />
              Ativo
            </label>
          </DialogBody>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={save} loading={saving} disabled={saving || !name.trim()}>
              {editing ? "Salvar" : "Criar centro"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Excluir centro de custo?"
        description={`“${deleting?.name}” será removido; transações vinculadas ficam sem centro.`}
        confirmLabel="Excluir"
        variant="danger"
        onConfirm={remove}
      />
    </Section>
  );
}

// ─── Categorias (pai/filho) ──────────────────────────────────────────────────

interface CategoryDraft {
  type: FinTransactionType;
  name: string;
  parent_id: string;
  is_active: boolean;
}

function CategoriesSection({
  categories,
  onChanged,
}: {
  categories: FinCategory[];
  onChanged: () => Promise<void> | void;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<FinCategory | null>(null);
  const [deleting, setDeleting] = useState<FinCategory | null>(null);
  const [draft, setDraft] = useState<CategoryDraft>({
    type: "revenue",
    name: "",
    parent_id: "",
    is_active: true,
  });
  const [saving, setSaving] = useState(false);

  const openNew = (type: FinTransactionType, parentId = "") => {
    setEditing(null);
    setDraft({ type, name: "", parent_id: parentId, is_active: true });
    setDialogOpen(true);
  };
  const openEdit = (cat: FinCategory) => {
    setEditing(cat);
    setDraft({
      type: cat.type,
      name: cat.name,
      parent_id: cat.parent_id ?? "",
      is_active: cat.is_active,
    });
    setDialogOpen(true);
  };

  const set = <K extends keyof CategoryDraft>(key: K, value: CategoryDraft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const parentsOf = (type: FinTransactionType) =>
    categories.filter((c) => c.type === type && !c.parent_id);
  const childrenOf = (parentId: string) => categories.filter((c) => c.parent_id === parentId);

  const parentOptions = useMemo(
    () => parentsOf(draft.type).filter((p) => p.id !== editing?.id),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [categories, draft.type, editing]
  );

  const save = async () => {
    setSaving(true);
    try {
      const payload = {
        type: draft.type,
        name: draft.name.trim(),
        parent_id: draft.parent_id || null,
        is_active: draft.is_active,
      };
      if (editing) {
        await api(`/api/finance/categories/${editing.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        await api("/api/finance/categories", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }
      toast({ title: editing ? "Categoria atualizada" : "Categoria criada" });
      setDialogOpen(false);
      await onChanged();
    } catch (e) {
      toast({ title: "Erro ao salvar", description: e instanceof Error ? e.message : "", variant: "error" });
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!deleting) return;
    try {
      await api(`/api/finance/categories/${deleting.id}`, { method: "DELETE" });
      toast({ title: "Categoria excluída" });
      await onChanged();
    } catch (e) {
      toast({ title: "Erro ao excluir", description: e instanceof Error ? e.message : "", variant: "error" });
    } finally {
      setDeleting(null);
    }
  };

  const renderColumn = (type: FinTransactionType) => (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3
          className={cn(
            "text-xs font-bold uppercase tracking-wider",
            type === "revenue" ? "text-green-700" : "text-red-700"
          )}
        >
          {type === "revenue" ? "Receitas" : "Despesas"}
        </h3>
        <button
          type="button"
          onClick={() => openNew(type)}
          className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:text-brand-800"
        >
          <Plus size={12} aria-hidden="true" /> Categoria
        </button>
      </div>
      <div className="space-y-1.5">
        {parentsOf(type).map((parent) => (
          <div key={parent.id} className="rounded-lg border border-gray-100 bg-gray-50/40 px-3 py-2">
            <div className="flex items-center justify-between gap-2">
              <span
                className={cn(
                  "text-sm font-semibold text-gray-900",
                  !parent.is_active && "text-gray-400 line-through"
                )}
              >
                {parent.name}
              </span>
              <div className="flex items-center gap-0.5">
                <button
                  type="button"
                  onClick={() => openNew(type, parent.id)}
                  className="rounded-md p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
                  aria-label={`Nova subcategoria em ${parent.name}`}
                  title="Nova subcategoria"
                >
                  <Plus size={13} aria-hidden="true" />
                </button>
                <RowActions
                  name={parent.name}
                  onEdit={() => openEdit(parent)}
                  onDelete={() => setDeleting(parent)}
                />
              </div>
            </div>
            {childrenOf(parent.id).map((child) => (
              <div key={child.id} className="mt-1 flex items-center justify-between gap-2 pl-1">
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 text-sm text-gray-600",
                    !child.is_active && "text-gray-400 line-through"
                  )}
                >
                  <CornerDownRight size={12} className="text-gray-300" aria-hidden="true" />
                  {child.name}
                </span>
                <RowActions
                  name={child.name}
                  onEdit={() => openEdit(child)}
                  onDelete={() => setDeleting(child)}
                />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <Section
      title="Categorias"
      description="Hierarquia de receitas e despesas usada nos lançamentos e relatórios."
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {renderColumn("revenue")}
        {renderColumn("expense")}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editing
                ? "Editar categoria"
                : draft.parent_id
                ? "Nova subcategoria"
                : `Nova categoria de ${FIN_TYPE_LABELS[draft.type].toLowerCase()}`}
            </DialogTitle>
          </DialogHeader>
          <DialogBody className="space-y-4">
            <div>
              <label className={labelClass}>Nome *</label>
              <input
                value={draft.name}
                onChange={(e) => set("name", e.target.value)}
                className={inputClass}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Categoria-pai</label>
                <select
                  value={draft.parent_id}
                  onChange={(e) => set("parent_id", e.target.value)}
                  className={cn(inputClass, "bg-white cursor-pointer")}
                >
                  <option value="">Nenhuma (nível raiz)</option>
                  {parentOptions.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-end pb-1">
                <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={draft.is_active}
                    onChange={(e) => set("is_active", e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-brand-500 focus:ring-brand-400"
                  />
                  Ativa
                </label>
              </div>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={save} loading={saving} disabled={saving || !draft.name.trim()}>
              {editing ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Excluir categoria?"
        description={`“${deleting?.name}” e suas subcategorias serão removidas; transações vinculadas ficam sem categoria.`}
        confirmLabel="Excluir"
        variant="danger"
        onConfirm={remove}
      />
    </Section>
  );
}

// ─── Ações de linha (editar/excluir) ─────────────────────────────────────────

function RowActions({
  name,
  onEdit,
  onDelete,
}: {
  name: string;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex shrink-0 items-center gap-0.5">
      <button
        type="button"
        onClick={onEdit}
        className="rounded-md p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
        aria-label={`Editar ${name}`}
      >
        <Pencil size={13} aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={onDelete}
        className="rounded-md p-1 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600"
        aria-label={`Excluir ${name}`}
      >
        <Trash2 size={13} aria-hidden="true" />
      </button>
    </div>
  );
}
