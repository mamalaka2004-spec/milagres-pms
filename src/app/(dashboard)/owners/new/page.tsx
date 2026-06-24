"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Save } from "lucide-react";
import { ownerSchema, type OwnerInput } from "@/lib/validations/owner";

export default function NewOwnerPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const { register, handleSubmit, formState: { errors } } = useForm<OwnerInput>({
    resolver: zodResolver(ownerSchema),
    defaultValues: { is_active: true },
  });

  const onSubmit = async (data: OwnerInput) => {
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/owners", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Falha ao salvar");
      router.push("/owners");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro");
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/owners" aria-label="Voltar para proprietários" className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40"><ArrowLeft size={18} aria-hidden="true" /></Link>
        <h1 className="text-xl lg:text-2xl font-bold text-gray-900">Novo proprietário</h1>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-4">
        <div>
          <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Nome completo *</label>
          <input {...register("full_name")} className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm transition-colors duration-200 focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-400/15" />
          {errors.full_name && <p className="text-xs text-red-500 mt-1">{errors.full_name.message}</p>}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Email</label>
            <input type="email" {...register("email")} className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm transition-colors duration-200 focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-400/15" />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Telefone</label>
            <input {...register("phone")} className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm transition-colors duration-200 focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-400/15" />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Tipo de documento</label>
            <select {...register("document_type")} className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm bg-white cursor-pointer transition-colors duration-200 focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-400/15">
              <option value="">Selecione</option>
              <option value="cpf">CPF</option>
              <option value="cnpj">CNPJ</option>
              <option value="passport">Passaporte</option>
              <option value="other">Outro</option>
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Número do documento</label>
            <input {...register("document_number")} className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm transition-colors duration-200 focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-400/15" />
          </div>
        </div>
        <div>
          <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Observações</label>
          <textarea {...register("notes")} rows={3} className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm transition-colors duration-200 focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-400/15" />
        </div>
        {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>}
        <div className="flex justify-end gap-3">
          <Link href="/owners" className="px-5 py-2.5 rounded-lg border border-gray-200 text-gray-600 font-semibold text-sm hover:bg-gray-50 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40">Cancelar</Link>
          <button type="submit" disabled={submitting} className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-brand-500 hover:bg-brand-600 text-white font-semibold text-sm transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40 disabled:opacity-50">
            <Save size={16} aria-hidden="true" /> {submitting ? "Salvando..." : "Criar proprietário"}
          </button>
        </div>
      </form>
    </div>
  );
}
