"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Save, AlertTriangle, CheckCircle2, Loader2, Star } from "lucide-react";
import {
  reservationUpdateSchema,
  type ReservationUpdateInput,
  CHANNEL_VALUES,
} from "@/lib/validations/reservation";
import { CHANNELS } from "@/lib/utils/constants";
import { FinancialBreakdown } from "@/components/reservations/financial-breakdown";

interface PropertyOption {
  id: string;
  name: string;
  code: string;
  max_guests: number;
}

export interface ReservationEditInitial {
  id: string;
  booking_code: string;
  property_id: string;
  channel: (typeof CHANNEL_VALUES)[number];
  channel_ref: string | null;
  check_in_date: string;
  check_out_date: string;
  num_guests: number;
  num_adults: number;
  num_children: number;
  status:
    | "inquiry"
    | "pending"
    | "confirmed"
    | "checked_in"
    | "checked_out"
    | "canceled"
    | "no_show";
  payment_status: "unpaid" | "partially_paid" | "paid" | "refunded";
  base_amount: number;
  cleaning_fee: number;
  extra_guest_fee: number;
  discount: number;
  platform_fee: number;
  tax: number;
  special_requests: string | null;
  internal_notes: string | null;
  guest: { id: string; full_name: string; is_vip: boolean } | null;
}

interface ReservationEditFormProps {
  reservation: ReservationEditInitial;
  properties: PropertyOption[];
}

const inputClass =
  "w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-400/15";
const labelClass =
  "block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5";

export function ReservationEditForm({ reservation, properties }: ReservationEditFormProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [availability, setAvailability] = useState<
    | { state: "idle" }
    | { state: "loading" }
    | { state: "available" }
    | { state: "unavailable"; reason: string }
  >({ state: "idle" });

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<ReservationUpdateInput>({
    resolver: zodResolver(reservationUpdateSchema),
    defaultValues: {
      property_id: reservation.property_id,
      channel: reservation.channel,
      channel_ref: reservation.channel_ref || "",
      check_in_date: reservation.check_in_date,
      check_out_date: reservation.check_out_date,
      num_guests: reservation.num_guests,
      num_adults: reservation.num_adults,
      num_children: reservation.num_children,
      status: reservation.status,
      payment_status: reservation.payment_status,
      base_amount: reservation.base_amount,
      cleaning_fee: reservation.cleaning_fee,
      extra_guest_fee: reservation.extra_guest_fee,
      discount: reservation.discount,
      platform_fee: reservation.platform_fee,
      tax: reservation.tax,
      special_requests: reservation.special_requests || "",
      internal_notes: reservation.internal_notes || "",
    },
  });

  const propertyId = watch("property_id");
  const checkIn = watch("check_in_date");
  const checkOut = watch("check_out_date");
  const baseAmount = watch("base_amount") || 0;
  const cleaningFee = watch("cleaning_fee") || 0;
  const extraGuestFee = watch("extra_guest_fee") || 0;
  const discount = watch("discount") || 0;
  const platformFee = watch("platform_fee") || 0;
  const tax = watch("tax") || 0;

  const nights = useMemo(() => {
    if (!checkIn || !checkOut) return 0;
    const ms = new Date(checkOut).getTime() - new Date(checkIn).getTime();
    return Math.max(0, Math.round(ms / (1000 * 60 * 60 * 24)));
  }, [checkIn, checkOut]);

  // Availability check (debounced) — excludes this reservation.
  useEffect(() => {
    if (!propertyId || !checkIn || !checkOut || checkOut <= checkIn) {
      setAvailability({ state: "idle" });
      return;
    }
    // No re-check needed if nothing changed from saved dates/property.
    if (
      propertyId === reservation.property_id &&
      checkIn === reservation.check_in_date &&
      checkOut === reservation.check_out_date
    ) {
      setAvailability({ state: "idle" });
      return;
    }
    setAvailability({ state: "loading" });
    const t = setTimeout(async () => {
      try {
        const res = await fetch("/api/reservations/check-availability", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            property_id: propertyId,
            check_in_date: checkIn,
            check_out_date: checkOut,
            exclude_reservation_id: reservation.id,
          }),
        });
        const json = await res.json();
        if (json.success && json.data.available) {
          setAvailability({ state: "available" });
        } else {
          const conflicts = json.data?.conflicting_reservations?.length || 0;
          const blocks = json.data?.conflicting_blocks?.length || 0;
          setAvailability({
            state: "unavailable",
            reason: `${conflicts} reservation conflict(s), ${blocks} blocked period(s)`,
          });
        }
      } catch {
        setAvailability({ state: "idle" });
      }
    }, 350);
    return () => clearTimeout(t);
  }, [propertyId, checkIn, checkOut, reservation.id, reservation.property_id, reservation.check_in_date, reservation.check_out_date]);

  const onSubmit = async (data: ReservationUpdateInput) => {
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(`/api/reservations/${reservation.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || "Failed to update reservation");
      }
      router.push(`/reservations/${reservation.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href={`/reservations/${reservation.id}`}
          aria-label="Back to reservation"
          className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40"
        >
          <ArrowLeft size={18} aria-hidden="true" />
        </Link>
        <div className="flex-1">
          <div className="font-mono text-xs text-gray-400">{reservation.booking_code}</div>
          <h1 className="text-xl lg:text-2xl font-bold text-gray-900">Edit Reservation</h1>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Guest (read-only) */}
        <Section title="Guest">
          {reservation.guest ? (
            <Link
              href={`/guests/${reservation.guest.id}`}
              className="font-semibold text-base text-gray-900 hover:text-brand-600 inline-flex items-center gap-2 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40 rounded"
            >
              {reservation.guest.full_name}
              {reservation.guest.is_vip && (
                <Star size={12} className="text-amber-500" fill="currentColor" aria-hidden="true" />
              )}
            </Link>
          ) : (
            <div className="text-sm text-gray-400">Guest not found.</div>
          )}
        </Section>

        {/* Property + Dates */}
        <Section title="Property & dates">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-3">
              <label className={labelClass}>Property *</label>
              <select {...register("property_id")} className={`${inputClass} bg-white cursor-pointer`}>
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.code}) — up to {p.max_guests}
                  </option>
                ))}
              </select>
              {errors.property_id && (
                <p className="text-xs text-red-500 mt-1">{errors.property_id.message}</p>
              )}
            </div>
            <div>
              <label className={labelClass}>Check-in *</label>
              <input type="date" {...register("check_in_date")} className={inputClass} />
              {errors.check_in_date && (
                <p className="text-xs text-red-500 mt-1">{errors.check_in_date.message}</p>
              )}
            </div>
            <div>
              <label className={labelClass}>Check-out *</label>
              <input type="date" {...register("check_out_date")} className={inputClass} />
              {errors.check_out_date && (
                <p className="text-xs text-red-500 mt-1">{errors.check_out_date.message}</p>
              )}
            </div>
            <div>
              <label className={labelClass}>Nights</label>
              <div className="px-4 py-2.5 rounded-lg border border-gray-100 bg-gray-50 text-sm font-mono">
                {nights || "—"}
              </div>
            </div>
          </div>

          {availability.state !== "idle" && (
            <div className="mt-3">
              {availability.state === "loading" && (
                <span className="inline-flex items-center gap-2 text-xs text-gray-500">
                  <Loader2 size={12} className="animate-spin" aria-hidden="true" /> Checking availability...
                </span>
              )}
              {availability.state === "available" && (
                <span className="inline-flex items-center gap-2 text-xs text-green-700 font-semibold">
                  <CheckCircle2 size={14} aria-hidden="true" /> Property available
                </span>
              )}
              {availability.state === "unavailable" && (
                <span className="inline-flex items-center gap-2 text-xs text-red-700 font-semibold">
                  <AlertTriangle size={14} aria-hidden="true" /> {availability.reason}
                </span>
              )}
            </div>
          )}
        </Section>

        {/* Guests count */}
        <Section title="Guests">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className={labelClass}>Total *</label>
              <input type="number" min={1} {...register("num_guests")} className={inputClass} />
              {errors.num_guests && (
                <p className="text-xs text-red-500 mt-1">{errors.num_guests.message}</p>
              )}
            </div>
            <div>
              <label className={labelClass}>Adults</label>
              <input type="number" min={1} {...register("num_adults")} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Children</label>
              <input type="number" min={0} {...register("num_children")} className={inputClass} />
            </div>
          </div>
        </Section>

        {/* Channel */}
        <Section title="Channel">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Source *</label>
              <select {...register("channel")} className={`${inputClass} bg-white cursor-pointer`}>
                {CHANNEL_VALUES.map((c) => (
                  <option key={c} value={c}>
                    {CHANNELS[c].label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Channel reference</label>
              <input {...register("channel_ref")} placeholder="HMABC1234" className={inputClass} />
            </div>
          </div>
        </Section>

        {/* Pricing */}
        <Section title="Pricing (R$)">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <PriceInput label="Base" register={register("base_amount", { valueAsNumber: true })} />
            <PriceInput label="Cleaning fee" register={register("cleaning_fee", { valueAsNumber: true })} />
            <PriceInput label="Extra guests" register={register("extra_guest_fee", { valueAsNumber: true })} />
            <PriceInput label="Discount" register={register("discount", { valueAsNumber: true })} />
            <PriceInput label="Tax" register={register("tax", { valueAsNumber: true })} />
            <PriceInput label="Platform fee" register={register("platform_fee", { valueAsNumber: true })} />
          </div>

          <div className="mt-4">
            <FinancialBreakdown
              input={{
                base_amount_cents: Math.round(baseAmount * 100),
                cleaning_fee_cents: Math.round(cleaningFee * 100),
                extra_guest_fee_cents: Math.round(extraGuestFee * 100),
                discount_cents: Math.round(discount * 100),
                platform_fee_cents: Math.round(platformFee * 100),
                tax_cents: Math.round(tax * 100),
                nights,
              }}
            />
          </div>
        </Section>

        {/* Status */}
        <Section title="Status">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Payment status</label>
              <select {...register("payment_status")} className={`${inputClass} bg-white cursor-pointer`}>
                <option value="unpaid">Unpaid</option>
                <option value="partially_paid">Partially paid</option>
                <option value="paid">Paid</option>
                <option value="refunded">Refunded</option>
              </select>
            </div>
          </div>
          <p className="text-[11px] text-gray-400 mt-2">
            Reservation status is managed through the status actions on the detail page.
          </p>
        </Section>

        {/* Notes */}
        <Section title="Notes">
          <div className="space-y-3">
            <div>
              <label className={labelClass}>Special requests (visible to guest)</label>
              <textarea {...register("special_requests")} rows={2} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Internal notes</label>
              <textarea {...register("internal_notes")} rows={2} className={inputClass} />
            </div>
          </div>
        </Section>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <Link
            href={`/reservations/${reservation.id}`}
            className="px-5 py-2.5 rounded-lg border border-gray-200 text-gray-600 font-semibold text-sm hover:bg-gray-50 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={submitting || availability.state === "unavailable"}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-brand-500 hover:bg-brand-600 text-white font-semibold text-sm transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40 disabled:opacity-50"
          >
            <Save size={16} aria-hidden="true" />
            {submitting ? "Saving..." : "Save changes"}
          </button>
        </div>
      </form>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-3">
      <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400">{title}</h2>
      {children}
    </div>
  );
}

function PriceInput({
  label,
  register,
}: {
  label: string;
  register: ReturnType<ReturnType<typeof useForm<ReservationUpdateInput>>["register"]>;
}) {
  return (
    <div>
      <label className={labelClass}>{label}</label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-mono">
          R$
        </span>
        <input
          type="number"
          step="0.01"
          min={0}
          {...register}
          className={`${inputClass} pl-9 font-mono`}
        />
      </div>
    </div>
  );
}
