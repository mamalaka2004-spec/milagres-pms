"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Edit, Save, Trash2, X, Mail, Phone, FileText } from "lucide-react";
import { ownerSchema, type OwnerInput } from "@/lib/validations/owner";
import { Button, Card, CardContent, Input, Label, Select, Textarea } from "@/components/ui";
import { OwnershipManager, type OwnershipLink } from "@/components/properties/ownership-manager";
import type { OwnerWithProperties } from "@/lib/db/queries/owners";

const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  cpf: "CPF",
  cnpj: "CNPJ",
  passport: "Passaporte",
  other: "Outro",
};

export function OwnerDetail({ owner, canManage }: { owner: OwnerWithProperties; canManage: boolean }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<OwnerInput>({
    resolver: zodResolver(ownerSchema),
    defaultValues: {
      full_name: owner.full_name,
      email: owner.email ?? "",
      phone: owner.phone ?? "",
      document_number: owner.document_number ?? "",
      document_type: (owner.document_type as OwnerInput["document_type"]) ?? undefined,
      notes: owner.notes ?? "",
      is_active: owner.is_active,
    },
  });

  const onSubmit = async (data: OwnerInput) => {
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(`/api/owners/${owner.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Falha ao salvar");
      setEditing(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro");
    } finally {
      setSubmitting(false);
    }
  };

  const onDelete = async () => {
    setDeleting(true);
    setError("");
    try {
      const res = await fetch(`/api/owners/${owner.id}`, { method: "DELETE" });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Falha ao excluir");
      router.push("/owners");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro");
      setDeleting(false);
      setConfirmingDelete(false);
    }
  };

  const ownershipLinks: OwnershipLink[] = (owner.property_ownership || [])
    .filter((o) => o.property)
    .map((o) => ({
      id: o.id,
      share_percentage: o.share_percentage,
      commission_percentage: o.commission_percentage,
      counterpart: { id: o.property!.id, name: o.property!.name, sublabel: o.property!.code },
    }));

  return (
    <div className="space-y-4 lg:space-y-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <Link
            href="/owners"
            aria-label="Voltar para proprietários"
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40"
          >
            <ArrowLeft size={18} aria-hidden="true" />
          </Link>
          <div>
            <h1 className="text-xl lg:text-2xl font-bold text-gray-900">{owner.full_name}</h1>
            <span className={`inline-flex items-center mt-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${owner.is_active ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"}`}>
              {owner.is_active ? "Ativo" : "Inativo"}
            </span>
          </div>
        </div>
        {!editing && (
          <Button onClick={() => { setError(""); setEditing(true); }}>
            <Edit size={15} aria-hidden="true" /> Editar
          </Button>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
      )}

      {editing ? (
        /* ─── Inline edit form ─── */
        <Card>
          <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
            <div>
              <Label className="mb-1.5">Nome completo *</Label>
              <Input {...register("full_name")} />
              {errors.full_name && <p className="text-xs text-red-500 mt-1">{errors.full_name.message}</p>}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="mb-1.5">Email</Label>
                <Input type="email" {...register("email")} />
                {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email.message}</p>}
              </div>
              <div>
                <Label className="mb-1.5">Telefone</Label>
                <Input {...register("phone")} />
              </div>
              <div>
                <Label className="mb-1.5">Tipo de documento</Label>
                <Select {...register("document_type")}>
                  <option value="">Selecione</option>
                  <option value="cpf">CPF</option>
                  <option value="cnpj">CNPJ</option>
                  <option value="passport">Passaporte</option>
                  <option value="other">Outro</option>
                </Select>
              </div>
              <div>
                <Label className="mb-1.5">Número do documento</Label>
                <Input {...register("document_number")} />
              </div>
            </div>
            <div>
              <Label className="mb-1.5">Observações</Label>
              <Textarea {...register("notes")} rows={3} />
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" {...register("is_active")} className="rounded border-gray-300 text-brand-500 focus:ring-brand-400/40" />
              Ativo
            </label>
            <div className="flex justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => { reset(); setEditing(false); setError(""); }}
              >
                <X size={16} aria-hidden="true" /> Cancelar
              </Button>
              <Button type="submit" loading={submitting}>
                <Save size={16} aria-hidden="true" /> {submitting ? "Salvando..." : "Salvar alterações"}
              </Button>
            </div>
          </form>
        </Card>
      ) : (
        /* ─── Read-only detail ─── */
        <>
          <Card>
            <CardContent className="space-y-3">
              <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Contato</h2>
              <div className="flex items-center gap-3 text-sm text-gray-600">
                <Mail size={16} aria-hidden="true" className="text-brand-500 shrink-0" />
                {owner.email || "—"}
              </div>
              <div className="flex items-center gap-3 text-sm text-gray-600">
                <Phone size={16} aria-hidden="true" className="text-brand-500 shrink-0" />
                {owner.phone || "—"}
              </div>
              <div className="flex items-center gap-3 text-sm text-gray-600">
                <FileText size={16} aria-hidden="true" className="text-brand-500 shrink-0" />
                {owner.document_number
                  ? `${owner.document_type ? `${DOCUMENT_TYPE_LABELS[owner.document_type] ?? owner.document_type}: ` : ""}${owner.document_number}`
                  : "—"}
              </div>
            </CardContent>
          </Card>

          {owner.notes && (
            <Card>
              <CardContent>
                <h2 className="text-sm font-bold text-gray-900 mb-3 uppercase tracking-wider">Observações</h2>
                <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">{owner.notes}</p>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent>
              <h2 className="text-sm font-bold text-gray-900 mb-1 uppercase tracking-wider">Imóveis e repasses</h2>
              <p className="text-xs text-gray-400 mb-4">Participação na propriedade e comissão de repasse por imóvel.</p>
              <OwnershipManager
                mode="owner"
                anchorId={owner.id}
                initialLinks={ownershipLinks}
                canManage={canManage}
              />
            </CardContent>
          </Card>

          {/* Danger zone — delete with two-step confirm */}
          <Card className="border-red-200">
            <CardContent className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Zona de perigo</h2>
                <p className="text-xs text-gray-500 mt-1">Excluir este proprietário permanentemente. Esta ação não pode ser desfeita.</p>
              </div>
              {confirmingDelete ? (
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-600">Tem certeza?</span>
                  <Button variant="secondary" onClick={() => setConfirmingDelete(false)} disabled={deleting}>
                    Cancelar
                  </Button>
                  <Button variant="danger" onClick={onDelete} loading={deleting}>
                    <Trash2 size={16} aria-hidden="true" /> {deleting ? "Excluindo..." : "Confirmar exclusão"}
                  </Button>
                </div>
              ) : (
                <Button variant="danger" onClick={() => setConfirmingDelete(true)}>
                  <Trash2 size={16} aria-hidden="true" /> Excluir proprietário
                </Button>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
