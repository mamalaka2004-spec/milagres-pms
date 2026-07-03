"use client";

// Grupos de anúncios — CRUD + membros (Fase 4)

import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, Home } from "lucide-react";
import {
  Button,
  ConfirmDialog,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui";
import { cn } from "@/lib/utils/cn";
import { api } from "@/lib/chat/utils";
import { toast } from "@/components/ui/use-toast";
import type { PropertyGroup } from "@/types/pricing";
import type { PropertyLite } from "@/components/pricing/pricing-shell";

const GROUP_COLORS = [
  "#7c9070", "#c9a84c", "#3b82f6", "#8b5cf6", "#ef4444",
  "#f59e0b", "#10b981", "#64748b", "#ec4899", "#06b6d4",
];

const inputClass =
  "w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-400/15";
const labelClass = "block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5";

interface GroupsTabProps {
  groups: PropertyGroup[];
  properties: PropertyLite[];
  onChanged: () => Promise<void> | void;
}

export function GroupsTab({ groups, properties, onChanged }: GroupsTabProps) {
  const [editing, setEditing] = useState<PropertyGroup | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState<PropertyGroup | null>(null);

  const remove = async () => {
    if (!deleting) return;
    try {
      await api(`/api/pricing/groups/${deleting.id}`, { method: "DELETE" });
      toast({ title: "Grupo excluído" });
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
          Agrupe anúncios parecidos (ex.: “Beira-mar”, “2 quartos”) e aplique regras de preço ao grupo
          inteiro de uma vez. Um imóvel pode estar em mais de um grupo.
        </p>
        <Button size="sm" onClick={() => { setEditing(null); setDialogOpen(true); }}>
          <Plus size={14} aria-hidden="true" /> Novo grupo
        </Button>
      </div>

      {groups.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/60 py-12 text-center text-sm text-gray-400">
          Nenhum grupo ainda.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {groups.map((group) => (
            <div key={group.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-card">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="h-3 w-3 shrink-0 rounded-full ring-1 ring-gray-200"
                    style={{ background: group.color }}
                    aria-hidden="true"
                  />
                  <span className="truncate font-semibold text-gray-900">{group.name}</span>
                </div>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => { setEditing(group); setDialogOpen(true); }}
                    className="rounded-md p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
                    aria-label={`Editar ${group.name}`}
                  >
                    <Pencil size={14} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleting(group)}
                    className="rounded-md p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600"
                    aria-label={`Excluir ${group.name}`}
                  >
                    <Trash2 size={14} aria-hidden="true" />
                  </button>
                </div>
              </div>
              {group.description && (
                <p className="mt-1 line-clamp-2 text-xs text-gray-500">{group.description}</p>
              )}
              <div className="mt-3 flex items-center gap-1.5 text-xs text-gray-500">
                <Home size={12} aria-hidden="true" />
                {(group.member_ids ?? []).length} imóvel(is)
              </div>
            </div>
          ))}
        </div>
      )}

      <GroupDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        group={editing}
        properties={properties}
        onSaved={onChanged}
      />

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Excluir grupo?"
        description={`As regras de preço aplicadas ao grupo “${deleting?.name}” também serão removidas.`}
        confirmLabel="Excluir"
        variant="danger"
        onConfirm={remove}
      />
    </div>
  );
}

interface GroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  group: PropertyGroup | null;
  properties: PropertyLite[];
  onSaved: () => Promise<void> | void;
}

function GroupDialog({ open, onOpenChange, group, properties, onSaved }: GroupDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState(GROUP_COLORS[0]);
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setName(group?.name ?? "");
      setDescription(group?.description ?? "");
      setColor(group?.color ?? GROUP_COLORS[0]);
      setMemberIds(group?.member_ids ?? []);
    }
  }, [open, group]);

  const toggleMember = (id: string) =>
    setMemberIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));

  const save = async () => {
    setSaving(true);
    try {
      const body = JSON.stringify({ name: name.trim(), description: description.trim() || null, color });
      const saved = group
        ? await api<PropertyGroup>(`/api/pricing/groups/${group.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body,
          })
        : await api<PropertyGroup>("/api/pricing/groups", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body,
          });
      await api(`/api/pricing/groups/${saved.id}/members`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ property_ids: memberIds }),
      });
      toast({ title: group ? "Grupo atualizado" : "Grupo criado" });
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
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{group ? "Editar grupo" : "Novo grupo de anúncios"}</DialogTitle>
        </DialogHeader>
        <DialogBody className="space-y-4">
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <label className={labelClass}>Nome *</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex.: Beira-mar"
                className={inputClass}
              />
            </div>
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="mb-0.5 h-9 w-9 shrink-0 rounded-lg border-2 border-white shadow ring-1 ring-gray-200"
                  style={{ background: color }}
                  aria-label="Escolher cor"
                />
              </PopoverTrigger>
              <PopoverContent align="end" className="w-auto p-2">
                <div className="grid grid-cols-5 gap-1.5">
                  {GROUP_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      className={cn("h-6 w-6 rounded-full border-2", color === c ? "border-gray-800" : "border-transparent")}
                      style={{ background: c }}
                      aria-label={`Cor ${c}`}
                    />
                  ))}
                </div>
              </PopoverContent>
            </Popover>
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

          <div>
            <label className={labelClass}>Imóveis do grupo ({memberIds.length})</label>
            <div className="max-h-56 space-y-1 overflow-y-auto rounded-lg border border-gray-200 p-2">
              {properties.map((p) => (
                <label
                  key={p.id}
                  className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
                >
                  <input
                    type="checkbox"
                    checked={memberIds.includes(p.id)}
                    onChange={() => toggleMember(p.id)}
                    className="h-4 w-4 rounded border-gray-300 text-brand-500 focus:ring-brand-400"
                  />
                  <span className="truncate">{p.name}</span>
                  <span className="ml-auto shrink-0 font-mono text-[11px] text-gray-400">{p.code}</span>
                </label>
              ))}
              {properties.length === 0 && (
                <p className="px-2 py-3 text-center text-xs text-gray-400">Nenhum imóvel cadastrado.</p>
              )}
            </div>
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={save} loading={saving} disabled={saving || !name.trim()}>
            {group ? "Salvar" : "Criar grupo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
