"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Home, UserCheck, Pencil, Trash2, Plus, Check, X } from "lucide-react";
import { Button, Input, Select, Label, ConfirmDialog } from "@/components/ui";

/**
 * OwnershipManager — CRUD for the `property_ownership` link (#11), rendered from
 * either side of the relationship:
 *  - mode="property": anchor is the imóvel, counterparts are proprietários.
 *  - mode="owner":    anchor is the proprietário, counterparts are imóveis.
 *
 * All mutations hit /api/ownerships (create) and /api/ownerships/[id]
 * (edit/remove). Read-only when `canManage` is false (staff role).
 */

export type OwnershipLink = {
  id: string;
  share_percentage: number;
  commission_percentage: number;
  counterpart: { id: string; name: string; sublabel?: string | null };
};

type Candidate = { id: string; name: string; sublabel?: string | null };

interface OwnershipManagerProps {
  mode: "property" | "owner";
  anchorId: string;
  initialLinks: OwnershipLink[];
  canManage: boolean;
}

const num = (v: unknown) => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
};

// Trim trailing ".00" for a cleaner read (85.00 → 85, 12.50 → 12.5).
const pct = (v: number) => `${parseFloat(num(v).toFixed(2))}%`;

export function OwnershipManager({ mode, anchorId, initialLinks, canManage }: OwnershipManagerProps) {
  const router = useRouter();
  const isProperty = mode === "property";
  const counterpartHref = (id: string) => (isProperty ? `/owners/${id}` : `/properties/${id}`);
  const CounterpartIcon = isProperty ? UserCheck : Home;

  const [links, setLinks] = useState<OwnershipLink[]>(initialLinks);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [error, setError] = useState("");

  // ── Add form ──
  const [adding, setAdding] = useState(false);
  const [selectedId, setSelectedId] = useState("");
  const [addShare, setAddShare] = useState("100");
  const [addCommission, setAddCommission] = useState("0");
  const [saving, setSaving] = useState(false);

  // ── Inline edit ──
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editShare, setEditShare] = useState("");
  const [editCommission, setEditCommission] = useState("");
  const [updating, setUpdating] = useState(false);

  // ── Remove ──
  const [removingLink, setRemovingLink] = useState<OwnershipLink | null>(null);
  const [removing, setRemoving] = useState(false);

  // Load candidates (the opposite side) so the user can pick who/what to link.
  useEffect(() => {
    if (!canManage) return;
    const endpoint = isProperty ? "/api/owners" : "/api/properties";
    fetch(endpoint)
      .then((r) => r.json())
      .then((res) => {
        if (!res?.data) return;
        const mapped: Candidate[] = res.data.map((row: Record<string, unknown>) =>
          isProperty
            ? { id: row.id as string, name: row.full_name as string, sublabel: (row.email as string) || null }
            : { id: row.id as string, name: row.name as string, sublabel: (row.code as string) || null }
        );
        setCandidates(mapped);
      })
      .catch(() => {});
  }, [canManage, isProperty]);

  const linkedIds = new Set(links.map((l) => l.counterpart.id));
  const available = candidates.filter((c) => !linkedIds.has(c.id));

  const resetAdd = () => {
    setAdding(false);
    setSelectedId("");
    setAddShare("100");
    setAddCommission("0");
    setError("");
  };

  const onCreate = async () => {
    if (!selectedId) {
      setError("Selecione um item para vincular.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const payload = {
        property_id: isProperty ? anchorId : selectedId,
        owner_id: isProperty ? selectedId : anchorId,
        share_percentage: Number(addShare),
        commission_percentage: Number(addCommission),
      };
      const res = await fetch("/api/ownerships", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Falha ao vincular");
      const chosen = candidates.find((c) => c.id === selectedId)!;
      setLinks((prev) => [
        ...prev,
        {
          id: result.data.id,
          share_percentage: num(payload.share_percentage),
          commission_percentage: num(payload.commission_percentage),
          counterpart: chosen,
        },
      ]);
      resetAdd();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro");
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (link: OwnershipLink) => {
    setEditingId(link.id);
    setEditShare(String(parseFloat(num(link.share_percentage).toFixed(2))));
    setEditCommission(String(parseFloat(num(link.commission_percentage).toFixed(2))));
    setError("");
  };

  const onUpdate = async (id: string) => {
    setUpdating(true);
    setError("");
    try {
      const res = await fetch(`/api/ownerships/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          share_percentage: Number(editShare),
          commission_percentage: Number(editCommission),
        }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Falha ao salvar");
      setLinks((prev) =>
        prev.map((l) =>
          l.id === id
            ? { ...l, share_percentage: num(editShare), commission_percentage: num(editCommission) }
            : l
        )
      );
      setEditingId(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro");
    } finally {
      setUpdating(false);
    }
  };

  const onRemove = async () => {
    if (!removingLink) return;
    setRemoving(true);
    setError("");
    try {
      const res = await fetch(`/api/ownerships/${removingLink.id}`, { method: "DELETE" });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Falha ao remover");
      setLinks((prev) => prev.filter((l) => l.id !== removingLink.id));
      setRemovingLink(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro");
    } finally {
      setRemoving(false);
    }
  };

  const emptyLabel = isProperty
    ? "Nenhum proprietário vinculado a este imóvel."
    : "Nenhuma participação em imóvel atribuída.";

  return (
    <div className="space-y-3">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}

      {links.length === 0 ? (
        <p className="text-sm text-gray-400">{emptyLabel}</p>
      ) : (
        <ul className="divide-y divide-gray-50">
          {links.map((link) => {
            const editing = editingId === link.id;
            return (
              <li key={link.id} className="flex flex-wrap items-center gap-3 py-2.5 text-sm">
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <CounterpartIcon size={14} aria-hidden="true" className="shrink-0 text-brand-500" />
                  <div className="min-w-0">
                    <Link
                      href={counterpartHref(link.counterpart.id)}
                      className="block truncate font-medium text-gray-900 hover:text-brand-600"
                    >
                      {link.counterpart.name}
                    </Link>
                    {link.counterpart.sublabel && (
                      <div className="truncate text-xs text-gray-400">{link.counterpart.sublabel}</div>
                    )}
                  </div>
                </div>

                {editing ? (
                  <div className="flex flex-wrap items-end gap-2">
                    <div>
                      <Label className="mb-1 text-[10px]">Participação %</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0.01"
                        max="100"
                        value={editShare}
                        onChange={(e) => setEditShare(e.target.value)}
                        className="h-8 w-24"
                      />
                    </div>
                    <div>
                      <Label className="mb-1 text-[10px]">Comissão %</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        value={editCommission}
                        onChange={(e) => setEditCommission(e.target.value)}
                        className="h-8 w-24"
                      />
                    </div>
                    <Button size="sm" onClick={() => onUpdate(link.id)} loading={updating}>
                      <Check size={14} aria-hidden="true" /> Salvar
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditingId(null)} disabled={updating}>
                      <X size={14} aria-hidden="true" />
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="text-right text-xs text-gray-500">
                      <div>
                        Participação: <strong className="font-mono text-gray-700">{pct(link.share_percentage)}</strong>
                      </div>
                      <div>
                        Comissão: <strong className="font-mono text-gray-700">{pct(link.commission_percentage)}</strong>
                      </div>
                    </div>
                    {canManage && (
                      <div className="flex items-center gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => startEdit(link)}
                          aria-label="Editar participação"
                        >
                          <Pencil size={14} aria-hidden="true" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => setRemovingLink(link)}
                          aria-label="Remover vínculo"
                          className="text-red-500 hover:bg-red-50"
                        >
                          <Trash2 size={14} aria-hidden="true" />
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {/* Add link */}
      {canManage && (
        <div className="pt-2">
          {adding ? (
            <div className="rounded-xl border border-gray-200 bg-gray-50/60 p-3 space-y-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Label className="mb-1.5">{isProperty ? "Proprietário" : "Imóvel"}</Label>
                  <Select value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
                    <option value="">Selecione…</option>
                    {available.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                        {c.sublabel ? ` — ${c.sublabel}` : ""}
                      </option>
                    ))}
                  </Select>
                  {available.length === 0 && (
                    <p className="mt-1 text-xs text-gray-400">
                      {isProperty
                        ? "Todos os proprietários já estão vinculados."
                        : "Todos os imóveis já estão vinculados."}
                    </p>
                  )}
                </div>
                <div>
                  <Label className="mb-1.5">Participação %</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0.01"
                    max="100"
                    value={addShare}
                    onChange={(e) => setAddShare(e.target.value)}
                  />
                </div>
                <div>
                  <Label className="mb-1.5">Comissão %</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={addCommission}
                    onChange={(e) => setAddCommission(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="secondary" size="sm" onClick={resetAdd} disabled={saving}>
                  Cancelar
                </Button>
                <Button size="sm" onClick={onCreate} loading={saving} disabled={available.length === 0}>
                  <Check size={14} aria-hidden="true" /> Vincular
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="subtle" size="sm" onClick={() => setAdding(true)}>
              <Plus size={14} aria-hidden="true" /> {isProperty ? "Adicionar proprietário" : "Adicionar imóvel"}
            </Button>
          )}
        </div>
      )}

      <ConfirmDialog
        open={removingLink !== null}
        onOpenChange={(o) => !o && setRemovingLink(null)}
        title="Remover vínculo?"
        description={
          removingLink
            ? `Desvincular “${removingLink.counterpart.name}”. Os percentuais deste vínculo serão perdidos.`
            : undefined
        }
        confirmLabel="Remover"
        variant="danger"
        loading={removing}
        onConfirm={onRemove}
      />
    </div>
  );
}
