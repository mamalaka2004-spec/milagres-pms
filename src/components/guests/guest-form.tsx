"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Save } from "lucide-react";
import { guestSchema, type GuestInput } from "@/lib/validations/guest";

interface GuestFormProps {
  initialData?: Partial<GuestInput> & { id?: string };
  redirectAfter?: string;
}

const inputClass =
  "w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-400/15";
const labelClass =
  "block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5";

export function GuestForm({ initialData, redirectAfter = "/guests" }: GuestFormProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const isEditing = !!initialData?.id;

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<GuestInput>({
    resolver: zodResolver(guestSchema),
    defaultValues: {
      full_name: initialData?.full_name || "",
      email: initialData?.email || "",
      phone: initialData?.phone || "",
      document_number: initialData?.document_number || "",
      document_type: initialData?.document_type,
      date_of_birth: initialData?.date_of_birth || "",
      nationality: initialData?.nationality || "",
      city: initialData?.city || "",
      state: initialData?.state || "",
      country: initialData?.country || "BR",
      language: initialData?.language || "pt-BR",
      notes: initialData?.notes || "",
      is_vip: initialData?.is_vip || false,
    },
  });

  const onSubmit = async (data: GuestInput) => {
    setSubmitting(true);
    setError("");
    try {
      const url = isEditing ? `/api/guests/${initialData!.id}` : "/api/guests";
      const method = isEditing ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Failed");
      router.push(redirectAfter);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href={redirectAfter} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500">
          <ArrowLeft size={18} />
        </Link>
        <h1 className="text-xl lg:text-2xl font-bold text-gray-900">
          {isEditing ? "Edit Guest" : "New Guest"}
        </h1>
      </div>

      <form
        onSubmit={handleSubmit(onSubmit)}
        className="bg-white rounded-xl border border-gray-200 p-6 space-y-4"
      >
        <div>
          <label className={labelClass}>Full Name *</label>
          <input {...register("full_name")} className={inputClass} />
          {errors.full_name && (
            <p className="text-xs text-red-500 mt-1">{errors.full_name.message}</p>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Email</label>
            <input type="email" {...register("email")} className={inputClass} />
            {errors.email && (
              <p className="text-xs text-red-500 mt-1">{errors.email.message}</p>
            )}
          </div>
          <div>
            <label className={labelClass}>Phone</label>
            <input
              {...register("phone")}
              placeholder="+55 82 99999-0000"
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Document Type</label>
            <select {...register("document_type")} className={`${inputClass} bg-white`}>
              <option value="">Select</option>
              <option value="cpf">CPF</option>
              <option value="rg">RG</option>
              <option value="passport">Passport</option>
              <option value="id_card">ID Card</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>Document Number</label>
            <input {...register("document_number")} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Date of Birth</label>
            <input type="date" {...register("date_of_birth")} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Nationality</label>
            <input
              {...register("nationality")}
              placeholder="Brazilian"
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>City</label>
            <input {...register("city")} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>State</label>
            <input {...register("state")} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Country</label>
            <input
              {...register("country")}
              placeholder="BR"
              maxLength={2}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Language</label>
            <select {...register("language")} className={`${inputClass} bg-white`}>
              <option value="pt-BR">Português</option>
              <option value="en">English</option>
              <option value="es">Español</option>
            </select>
          </div>
        </div>

        <div>
          <label className={labelClass}>Notes</label>
          <textarea
            {...register("notes")}
            rows={3}
            className={inputClass}
            placeholder="Internal notes about this guest..."
          />
        </div>

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            {...register("is_vip")}
            className="w-4 h-4 rounded border-gray-300 text-brand-500 focus:ring-brand-400/30"
          />
          <span className="text-sm text-gray-700">Mark as VIP</span>
        </label>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <Link
            href={redirectAfter}
            className="px-5 py-2.5 rounded-lg border border-gray-200 text-gray-600 font-semibold text-sm hover:bg-gray-50"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={submitting}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-brand-500 hover:bg-brand-600 text-white font-semibold text-sm transition disabled:opacity-50"
          >
            <Save size={16} /> {submitting ? "Saving..." : isEditing ? "Save Changes" : "Create Guest"}
          </button>
        </div>
      </form>
    </div>
  );
}
