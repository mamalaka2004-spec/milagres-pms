"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Save, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import {
  reservationSchema,
  type ReservationInput,
  CHANNEL_VALUES,
} from "@/lib/validations/reservation";
import { CHANNELS } from "@/lib/utils/constants";
import {
  GuestSearchSelect,
  type GuestOption,
} from "@/components/guests/guest-search-select";
import { FinancialBreakdown } from "@/components/reservations/financial-breakdown";

interface PropertyOption {
  id: string;
  name: string;
  code: string;
  max_guests: number;
  base_price_cents: number;
  cleaning_fee_cents: number;
  extra_guest_fee_cents: number;
  extra_guest_after: number;
}

interface ReservationFormProps {
  properties: PropertyOption[];
  initialGuest?: GuestOption | null;
}

const inputClass =
  "w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-400/15";
const labelClass =
  "block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5";

export function ReservationForm({ properties, initialGuest }: ReservationFormProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [guest, setGuest] = useState<GuestOption | null>(initialGuest || null);
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
    setValue,
    formState: { errors },
  } = useForm<ReservationInput>({
    resolver: zodResolver(reservationSchema),
    defaultValues: {
      property_id: properties[0]?.id || "",
      guest_id: initialGuest?.id || "",
      channel: "direct",
      check_in_date: "",
      check_out_date: "",
      num_guests: 2,
      num_adults: 2,
      num_children: 0,
      status: "pending",
      payment_status: "unpaid",
      base_amount: 0,
      cleaning_fee: 0,
      extra_guest_fee: 0,
      discount: 0,
      platform_fee: 0,
      tax: 0,
    },
  });

  const propertyId = watch("property_id");
  const checkIn = watch("check_in_date");
  const checkOut = watch("check_out_date");
  const numGuests = watch("num_guests");
  const baseAmount = watch("base_amount") || 0;
  const cleaningFee = watch("cleaning_fee") || 0;
  const extraGuestFee = watch("extra_guest_fee") || 0;
  const discount = watch("discount") || 0;
  const platformFee = watch("platform_fee") || 0;
  const tax = watch("tax") || 0;

  const selectedProperty = useMemo(
    () => properties.find((p) => p.id === propertyId),
    [properties, propertyId]
  );

  const nights = useMemo(() => {
    if (!checkIn || !checkOut) return 0;
    const ms = new Date(checkOut).getTime() - new Date(checkIn).getTime();
    return Math.max(0, Math.round(ms / (1000 * 60 * 60 * 24)));
  }, [checkIn, checkOut]);

  // Auto-prefill price + cleaning fee when property changes
  useEffect(() => {
    if (!selectedProperty) return;
    setValue("cleaning_fee", selectedProperty.cleaning_fee_cents / 100);
  }, [selectedProperty, setValue]);

  // Auto-suggest base amount = nightly × nights when property + dates set
  useEffect(() => {
    if (!selectedProperty || nights === 0) return;
    const suggested = (selectedProperty.base_price_cents * nights) / 100;
    setValue("base_amount", suggested);

    // Extra guest fee
    if (selectedProperty.extra_guest_after > 0 && numGuests > selectedProperty.extra_guest_after) {
      const extra = numGuests - selectedProperty.extra_guest_after;
      const extraFee = (selectedProperty.extra_guest_fee_cents * extra * nights) / 100;
      setValue("extra_guest_fee", extraFee);
    } else {
      setValue("extra_guest_fee", 0);
    }
  }, [selectedProperty, nights, numGuests, setValue]);

  // Sync guest_id field with guest state
  useEffect(() => {
    if (guest?.id) setValue("guest_id", guest.id);
    else setValue("guest_id", "");
  }, [guest, setValue]);

  // Availability check (debounced)
  useEffect(() => {
    if (!propertyId || !checkIn || !checkOut || checkOut <= checkIn) {
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
  }, [propertyId, checkIn, checkOut]);

  const onSubmit = async (data: ReservationInput) => {
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || "Failed to create reservation");
      }
      router.push(`/reservations/${result.data.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/reservations" className="p-2 rounded-lg hover:bg-gray-100 text-gray-500">
          <ArrowLeft size={18} />
        </Link>
        <h1 className="text-xl lg:text-2xl font-bold text-gray-900">New Reservation</h1>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Guest */}
        <Section title="Guest">
          <GuestSearchSelect
            value={guest}
            onChange={setGuest}
            onCreateNew={() => router.push("/guests/new?return=/reservations/new")}
          />
          <input type="hidden" {...register("guest_id")} />
          {errors.guest_id && (
            <p className="text-xs text-red-500 mt-1">{errors.guest_id.message}</p>
          )}
        </Section>

        {/* Property + Dates */}
        <Section title="Property & dates">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-3">
              <label className={labelClass}>Property *</label>
              <select {...register("property_id")} className={`${inputClass} bg-white`}>
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
                  <Loader2 size={12} className="animate-spin" /> Checking availability...
                </span>
              )}
              {availability.state === "available" && (
                <span className="inline-flex items-center gap-2 text-xs text-green-700 font-semibold">
                  <CheckCircle2 size={14} /> Property available
                </span>
              )}
              {availability.state === "unavailable" && (
                <span className="inline-flex items-center gap-2 text-xs text-red-700 font-semibold">
                  <AlertTriangle size={14} /> {availability.reason}
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
              <input
                type="number"
                min={1}
                {...register("num_guests")}
                className={inputClass}
              />
              {errors.num_guests && (
                <p className="text-xs text-red-500 mt-1">{errors.num_guests.message}</p>
              )}
            </div>
            <div>
              <label className={labelClass}>Adults</label>
              <input
                type="number"
                min={1}
                {...register("num_adults")}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Children</label>
              <input
                type="number"
                min={0}
                {...register("num_children")}
                className={inputClass}
              />
            </div>
          </div>
        </Section>

        {/* Channel */}
        <Section title="Channel">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Source *</label>
              <select {...register("channel")} className={`${inputClass} bg-white`}>
                {CHANNEL_VALUES.map((c) => (
                  <option key={c} value={c}>
                    {CHANNELS[c].label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Channel reference</label>
              <input
                {...register("channel_ref")}
                placeholder="HMABC1234"
                className={inputClass}
              />
            </div>
          </div>
        </Section>

        {/* Pricing */}
        <Section title="Pricing (R$)">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <PriceInput
              label="Base"
              register={register("base_amount", { valueAsNumber: true })}
            />
            <PriceInput
              label="Cleaning fee"
              register={register("cleaning_fee", { valueAsNumber: true })}
            />
            <PriceInput
              label="Extra guests"
              register={register("extra_guest_fee", { valueAsNumber: true })}
            />
            <PriceInput
              label="Discount"
              register={register("discount", { valueAsNumber: true })}
            />
            <PriceInput
              label="Tax"
              register={register("tax", { valueAsNumber: true })}
            />
            <PriceInput
              label="Platform fee"
              register={register("platform_fee", { valueAsNumber: true })}
            />
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
              <label className={labelClass}>Reservation status</label>
              <select {...register("status")} className={`${inputClass} bg-white`}>
                <option value="inquiry">Inquiry</option>
                <option value="pending">Pending</option>
                <option value="confirmed">Confirmed</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Payment status</label>
              <select {...register("payment_status")} className={`${inputClass} bg-white`}>
                <option value="unpaid">Unpaid</option>
                <option value="partially_paid">Partially paid</option>
                <option value="paid">Paid</option>
              </select>
            </div>
          </div>
        </Section>

        {/* Notes */}
        <Section title="Notes">
          <div className="space-y-3">
            <div>
              <label className={labelClass}>Special requests (visible to guest)</label>
              <textarea
                {...register("special_requests")}
                rows={2}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Internal notes</label>
              <textarea
                {...register("internal_notes")}
                rows={2}
                className={inputClass}
              />
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
            href="/reservations"
            className="px-5 py-2.5 rounded-lg border border-gray-200 text-gray-600 font-semibold text-sm hover:bg-gray-50"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={submitting || availability.state === "unavailable"}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-brand-500 hover:bg-brand-600 text-white font-semibold text-sm transition disabled:opacity-50"
          >
            <Save size={16} />
            {submitting ? "Creating..." : "Create Reservation"}
          </button>
        </div>
      </form>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
      <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400">
        {title}
      </h2>
      {children}
    </div>
  );
}

function PriceInput({
  label,
  register,
}: {
  label: string;
  register: ReturnType<ReturnType<typeof useForm<ReservationInput>>["register"]>;
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
