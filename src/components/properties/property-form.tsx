"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { propertySchema, type PropertyInput } from "@/lib/validations/property";
import { Save, ArrowLeft } from "lucide-react";
import Link from "next/link";

interface PropertyFormProps {
  initialData?: Partial<PropertyInput> & { id?: string };
}

export function PropertyForm({ initialData }: PropertyFormProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const isEditing = !!initialData?.id;

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
  } = useForm<PropertyInput>({
    resolver: zodResolver(propertySchema),
    defaultValues: {
      name: initialData?.name || "",
      code: initialData?.code || "",
      slug: initialData?.slug || "",
      status: initialData?.status || "active",
      type: initialData?.type,
      country: initialData?.country || "BR",
      city: initialData?.city || "São Miguel dos Milagres",
      state: initialData?.state || "AL",
      address: initialData?.address || "",
      neighborhood: initialData?.neighborhood || "",
      max_guests: initialData?.max_guests || 2,
      bedrooms: initialData?.bedrooms || 1,
      beds: initialData?.beds || 1,
      bathrooms: initialData?.bathrooms || 1,
      title: initialData?.title || "",
      subtitle: initialData?.subtitle || "",
      description: initialData?.description || "",
      house_rules: initialData?.house_rules || "",
      cancellation_policy: initialData?.cancellation_policy || "",
      cancellation_policy_type: initialData?.cancellation_policy_type || "flexible",
      cancellation_cutoff_days: initialData?.cancellation_cutoff_days ?? 0,
      check_in_time: initialData?.check_in_time || "15:00",
      check_out_time: initialData?.check_out_time || "11:00",
      min_nights: initialData?.min_nights || 2,
      max_nights: initialData?.max_nights || 30,
      base_price: initialData?.base_price || 0,
      cleaning_fee: initialData?.cleaning_fee || 0,
      extra_guest_fee: initialData?.extra_guest_fee || 0,
      extra_guest_after: initialData?.extra_guest_after || 0,
      instant_booking_enabled: initialData?.instant_booking_enabled || false,
      is_featured: initialData?.is_featured || false,
      airbnb_ical_url: initialData?.airbnb_ical_url || "",
      airbnb_listing_url: initialData?.airbnb_listing_url || "",
      booking_ical_url: initialData?.booking_ical_url || "",
      booking_listing_url: initialData?.booking_listing_url || "",
    },
  });

  // Auto-generate slug from name
  const watchName = watch("name");

  const onSubmit = async (data: PropertyInput) => {
    setSubmitting(true);
    setError("");

    try {
      const url = isEditing
        ? `/api/properties/${initialData.id}`
        : "/api/properties";
      const method = isEditing ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || "Failed to save property");
      }

      router.push(`/properties/${result.data.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/properties"
          aria-label="Voltar para imóveis"
          className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40"
        >
          <ArrowLeft size={18} aria-hidden="true" />
        </Link>
        <h1 className="text-xl lg:text-2xl font-bold text-gray-900">
          {isEditing ? "Editar imóvel" : "Novo imóvel"}
        </h1>
      </div>

      {/* Basic Info */}
      <section className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 lg:p-6">
        <h2 className="text-sm font-bold text-gray-900 mb-4 uppercase tracking-wider">
          Informações básicas
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Nome *" error={errors.name?.message}>
            <input {...register("name")} placeholder="Casa Coral" className="form-input" />
          </Field>
          <Field label="Código *" error={errors.code?.message}>
            <input {...register("code")} placeholder="MIL-01" className="form-input uppercase" />
          </Field>
          <Field label="Slug (URL) *" error={errors.slug?.message}>
            <input {...register("slug")} placeholder="casa-coral" className="form-input" />
          </Field>
          <Field label="Tipo">
            <select {...register("type")} className="form-input cursor-pointer">
              <option value="">Selecione o tipo</option>
              <option value="house">Casa</option>
              <option value="apartment">Apartamento</option>
              <option value="studio">Studio</option>
              <option value="villa">Villa</option>
              <option value="cabin">Chalé</option>
              <option value="room">Quarto</option>
              <option value="other">Outro</option>
            </select>
          </Field>
          <Field label="Status">
            <select {...register("status")} className="form-input cursor-pointer">
              <option value="active">Ativo</option>
              <option value="inactive">Inativo</option>
              <option value="maintenance">Manutenção</option>
            </select>
          </Field>
        </div>
      </section>

      {/* Display */}
      <section className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 lg:p-6">
        <h2 className="text-sm font-bold text-gray-900 mb-4 uppercase tracking-wider">
          Exibição
        </h2>
        <div className="space-y-4">
          <Field label="Título público">
            <input {...register("title")} placeholder="Casa Coral - Refúgio à beira-mar" className="form-input" />
          </Field>
          <Field label="Subtítulo">
            <input {...register("subtitle")} placeholder="Refúgio com piscina privativa" className="form-input" />
          </Field>
          <Field label="Descrição">
            <textarea {...register("description")} rows={5} placeholder="Conte aos hóspedes sobre este imóvel..." className="form-input resize-y" />
          </Field>
        </div>
      </section>

      {/* Location */}
      <section className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 lg:p-6">
        <h2 className="text-sm font-bold text-gray-900 mb-4 uppercase tracking-wider">
          Localização
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Endereço">
            <input {...register("address")} className="form-input" />
          </Field>
          <Field label="Bairro">
            <input {...register("neighborhood")} className="form-input" />
          </Field>
          <Field label="Cidade">
            <input {...register("city")} className="form-input" />
          </Field>
          <Field label="Estado">
            <input {...register("state")} className="form-input" />
          </Field>
        </div>
      </section>

      {/* Capacity */}
      <section className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 lg:p-6">
        <h2 className="text-sm font-bold text-gray-900 mb-4 uppercase tracking-wider">
          Capacidade
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Field label="Máx. de hóspedes *" error={errors.max_guests?.message}>
            <input type="number" {...register("max_guests")} className="form-input" />
          </Field>
          <Field label="Quartos">
            <input type="number" {...register("bedrooms")} className="form-input" />
          </Field>
          <Field label="Camas">
            <input type="number" {...register("beds")} className="form-input" />
          </Field>
          <Field label="Banheiros">
            <input type="number" {...register("bathrooms")} className="form-input" />
          </Field>
        </div>
      </section>

      {/* Pricing */}
      <section className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 lg:p-6">
        <h2 className="text-sm font-bold text-gray-900 mb-4 uppercase tracking-wider">
          Pricing (BRL)
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Preço base / noite *" error={errors.base_price?.message}>
            <input type="number" step="0.01" {...register("base_price")} className="form-input" placeholder="490.00" />
          </Field>
          <Field label="Taxa de limpeza">
            <input type="number" step="0.01" {...register("cleaning_fee")} className="form-input" placeholder="150.00" />
          </Field>
          <Field label="Taxa por hóspede extra">
            <input type="number" step="0.01" {...register("extra_guest_fee")} className="form-input" placeholder="0.00" />
          </Field>
          <Field label="Cobrar a partir de N hóspedes">
            <input type="number" {...register("extra_guest_after")} className="form-input" placeholder="0" />
          </Field>
        </div>
      </section>

      {/* Rules */}
      <section className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 lg:p-6">
        <h2 className="text-sm font-bold text-gray-900 mb-4 uppercase tracking-wider">
          Regras & Políticas
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <Field label="Horário de check-in">
            <input {...register("check_in_time")} className="form-input" placeholder="15:00" />
          </Field>
          <Field label="Horário de check-out">
            <input {...register("check_out_time")} className="form-input" placeholder="11:00" />
          </Field>
          <Field label="Mín. de noites" error={errors.min_nights?.message}>
            <input type="number" {...register("min_nights")} className="form-input" />
          </Field>
          <Field label="Máx. de noites" error={errors.max_nights?.message}>
            <input type="number" {...register("max_nights")} className="form-input" />
          </Field>
        </div>
        <p className="text-[11px] text-gray-400 mb-4 -mt-1">
          Mín./máx. de noites são aplicados na criação de reservas (site e manual).
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <Field label="Política de cancelamento">
            <select {...register("cancellation_policy_type")} className="form-input cursor-pointer">
              <option value="flexible">Flexível</option>
              <option value="moderate">Moderada</option>
              <option value="strict">Rígida</option>
              <option value="non_refundable">Não reembolsável</option>
              <option value="custom">Personalizada</option>
            </select>
          </Field>
          <Field label="Cancelamento gratuito até (dias antes)" error={errors.cancellation_cutoff_days?.message}>
            <input type="number" {...register("cancellation_cutoff_days")} className="form-input" placeholder="0" />
          </Field>
        </div>
        <div className="space-y-4">
          <Field label="Regras da casa">
            <textarea {...register("house_rules")} rows={4} className="form-input resize-y" />
          </Field>
          <Field label="Detalhes da política de cancelamento">
            <textarea {...register("cancellation_policy")} rows={3} className="form-input resize-y" placeholder="Descreva as condições de reembolso mostradas ao hóspede." />
          </Field>
        </div>
      </section>

      {/* Channel Sync */}
      <section className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 lg:p-6">
        <h2 className="text-sm font-bold text-gray-900 mb-1 uppercase tracking-wider">
          Sincronização de canais
        </h2>
        <p className="text-xs text-gray-500 mb-4">
          Cole os links iCal de exportação do Airbnb e Booking — usamos para puxar bloqueios de calendário automaticamente.
        </p>
        <div className="space-y-4">
          <Field label="Airbnb iCal URL" error={errors.airbnb_ical_url?.message}>
            <input
              {...register("airbnb_ical_url")}
              placeholder="https://www.airbnb.com/calendar/ical/12345678.ics?s=..."
              className="form-input"
            />
            <p className="text-[10px] text-gray-400 mt-1">
              No Airbnb: Anúncio → Calendário → Disponibilidade → Conectar a outro site → Exportar calendário
            </p>
          </Field>
          <Field label="URL do anúncio no Airbnb (opcional)" error={errors.airbnb_listing_url?.message}>
            <input
              {...register("airbnb_listing_url")}
              placeholder="https://www.airbnb.com/rooms/12345678"
              className="form-input"
            />
          </Field>
          <Field label="Booking.com iCal URL" error={errors.booking_ical_url?.message}>
            <input
              {...register("booking_ical_url")}
              placeholder="https://admin.booking.com/.../ical.ics?t=..."
              className="form-input"
            />
            <p className="text-[10px] text-gray-400 mt-1">
              Na Extranet da Booking: Tarifas e disponibilidade → Sincronizar calendários → Exportar calendário
            </p>
          </Field>
          <Field label="URL do anúncio na Booking (opcional)" error={errors.booking_listing_url?.message}>
            <input
              {...register("booking_listing_url")}
              placeholder="https://www.booking.com/hotel/br/casa-coral.html"
              className="form-input"
            />
          </Field>
        </div>
      </section>

      {/* Booking Settings */}
      <section className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 lg:p-6">
        <h2 className="text-sm font-bold text-gray-900 mb-4 uppercase tracking-wider">
          Configurações de reserva
        </h2>
        <div className="space-y-3">
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" {...register("instant_booking_enabled")} className="w-4 h-4 accent-brand-500" />
            <div>
              <div className="text-sm font-semibold text-gray-900">Reserva instantânea</div>
              <div className="text-xs text-gray-500">Hóspedes podem reservar sem aguardar aprovação</div>
            </div>
          </label>
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" {...register("is_featured")} className="w-4 h-4 accent-brand-500" />
            <div>
              <div className="text-sm font-semibold text-gray-900">Imóvel em destaque</div>
              <div className="text-xs text-gray-500">Exibir na seção de destaques da página inicial</div>
            </div>
          </label>
        </div>
      </section>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-3 pb-20 lg:pb-6">
        <Link
          href="/properties"
          className="px-5 py-2.5 rounded-lg border border-gray-200 text-gray-600 font-semibold text-sm hover:bg-gray-50 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40"
        >
          Cancelar
        </Link>
        <button
          type="submit"
          disabled={submitting}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-brand-500 hover:bg-brand-600 text-white font-semibold text-sm transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40 disabled:opacity-50"
        >
          <Save size={16} aria-hidden="true" />
          {submitting ? "Salvando..." : isEditing ? "Salvar alterações" : "Criar imóvel"}
        </button>
      </div>

      <style jsx>{`
        :global(.form-input) {
          width: 100%;
          padding: 10px 14px;
          border-radius: 8px;
          border: 1px solid #e5e5e5;
          font-size: 14px;
          color: #1a1a1a;
          background: #fff;
          transition: all 0.15s;
          font-family: inherit;
        }
        :global(.form-input:focus) {
          outline: none;
          border-color: #8a9b7e;
          box-shadow: 0 0 0 3px rgba(138, 155, 126, 0.15);
        }
      `}</style>
    </form>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
        {label}
      </label>
      {children}
      {error && <p className="text-[11px] text-red-500 mt-1">{error}</p>}
    </div>
  );
}
