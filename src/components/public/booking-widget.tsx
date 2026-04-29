"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, AlertTriangle, CheckCircle2, Minus, Plus, MessageCircle } from "lucide-react";
import { formatCurrency } from "@/lib/utils/format";

interface BookingWidgetProps {
  propertyId: string;
  slug: string;
  basePriceCents: number;
  cleaningFeeCents: number;
  extraGuestFeeCents: number;
  extraGuestAfter: number;
  maxGuests: number;
  minNights: number;
  instantBooking: boolean;
  whatsappUrl: string;
}

export function BookingWidget({
  propertyId,
  slug,
  basePriceCents,
  cleaningFeeCents,
  extraGuestFeeCents,
  extraGuestAfter,
  maxGuests,
  minNights,
  instantBooking,
  whatsappUrl,
}: BookingWidgetProps) {
  const router = useRouter();
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [guests, setGuests] = useState(2);
  const [availability, setAvailability] = useState<
    | { state: "idle" }
    | { state: "loading" }
    | { state: "available" }
    | { state: "unavailable"; message: string }
  >({ state: "idle" });

  const nights = (() => {
    if (!checkIn || !checkOut) return 0;
    const ms = new Date(checkOut).getTime() - new Date(checkIn).getTime();
    return Math.max(0, Math.round(ms / (24 * 60 * 60 * 1000)));
  })();
  const datesValid = !!checkIn && !!checkOut && nights >= minNights;

  const baseTotal = basePriceCents * nights;
  const extraGuestTotal =
    extraGuestAfter > 0 && guests > extraGuestAfter
      ? extraGuestFeeCents * (guests - extraGuestAfter) * nights
      : 0;
  const subTotal = baseTotal + cleaningFeeCents + extraGuestTotal;

  // Debounced availability check when both dates valid
  useEffect(() => {
    if (!datesValid) {
      setAvailability({ state: "idle" });
      return;
    }
    setAvailability({ state: "loading" });
    const t = setTimeout(async () => {
      try {
        const res = await fetch("/api/booking/check-availability", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slug, check_in_date: checkIn, check_out_date: checkOut }),
        });
        const json = await res.json();
        if (json.success && json.data.available) {
          setAvailability({ state: "available" });
        } else {
          setAvailability({
            state: "unavailable",
            message: json.data?.message || "Datas indisponíveis para esta propriedade.",
          });
        }
      } catch {
        setAvailability({ state: "unavailable", message: "Não foi possível verificar agora. Tente novamente." });
      }
    }, 350);
    return () => clearTimeout(t);
  }, [datesValid, checkIn, checkOut, slug]);

  const goToBooking = () => {
    const qs = new URLSearchParams({
      check_in: checkIn,
      check_out: checkOut,
      guests: String(guests),
    });
    router.push(`/p/${slug}/book?${qs.toString()}`);
  };

  return (
    <div className="bg-white rounded-2xl border border-brand-200/40 shadow-[0_8px_32px_rgba(74,90,64,0.08)] p-5 md:p-7">
      <div className="flex items-baseline gap-1.5 mb-2">
        <span className="font-heading text-3xl md:text-4xl font-semibold text-brand-600">
          {basePriceCents > 0 ? formatCurrency(basePriceCents) : "—"}
        </span>
        {basePriceCents > 0 && <span className="text-xs text-gray-400">/ noite</span>}
      </div>

      <div className="border border-brand-200 rounded-xl overflow-hidden mb-3">
        <div className="grid grid-cols-2">
          <label className="block px-4 py-2.5 border-r border-brand-200">
            <span className="block text-[9px] font-semibold uppercase tracking-[0.2em] text-gray-500">
              Check-in
            </span>
            <input
              type="date"
              value={checkIn}
              onChange={(e) => setCheckIn(e.target.value)}
              className="block w-full mt-1 text-sm text-gray-900 bg-transparent border-0 focus:outline-none"
            />
          </label>
          <label className="block px-4 py-2.5">
            <span className="block text-[9px] font-semibold uppercase tracking-[0.2em] text-gray-500">
              Check-out
            </span>
            <input
              type="date"
              value={checkOut}
              onChange={(e) => setCheckOut(e.target.value)}
              className="block w-full mt-1 text-sm text-gray-900 bg-transparent border-0 focus:outline-none"
            />
          </label>
        </div>
        <div className="px-4 py-2.5 border-t border-brand-200 flex items-center justify-between">
          <div>
            <div className="text-[9px] font-semibold uppercase tracking-[0.2em] text-gray-500">
              Hóspedes
            </div>
            <div className="text-sm text-gray-900 mt-1">
              {guests} {guests === 1 ? "hóspede" : "hóspedes"}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setGuests((g) => Math.max(1, g - 1))}
              className="w-8 h-8 rounded-full border border-brand-200 hover:bg-gray-50 flex items-center justify-center"
            >
              <Minus size={14} />
            </button>
            <span className="font-semibold w-5 text-center">{guests}</span>
            <button
              type="button"
              onClick={() => setGuests((g) => Math.min(maxGuests, g + 1))}
              className="w-8 h-8 rounded-full border border-brand-200 hover:bg-gray-50 flex items-center justify-center"
            >
              <Plus size={14} />
            </button>
          </div>
        </div>
      </div>

      {checkIn && checkOut && nights > 0 && nights < minNights && (
        <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-3 flex items-start gap-2">
          <AlertTriangle size={13} className="mt-0.5" />
          <span>Estadia mínima de {minNights} noites para esta propriedade.</span>
        </div>
      )}

      {availability.state === "loading" && (
        <div className="text-xs text-gray-500 inline-flex items-center gap-2 mb-3">
          <Loader2 size={12} className="animate-spin" /> Verificando disponibilidade...
        </div>
      )}
      {availability.state === "available" && (
        <div className="text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2 mb-3 inline-flex items-center gap-2">
          <CheckCircle2 size={13} /> Datas disponíveis!
        </div>
      )}
      {availability.state === "unavailable" && (
        <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3 flex items-start gap-2">
          <AlertTriangle size={13} className="mt-0.5" />
          <span>{availability.message}</span>
        </div>
      )}

      {datesValid && nights > 0 && availability.state === "available" && basePriceCents > 0 && (
        <div className="space-y-1.5 mb-4 text-sm">
          <Row label={`R$ ${(basePriceCents / 100).toFixed(0)} × ${nights} ${nights === 1 ? "noite" : "noites"}`} value={formatCurrency(baseTotal)} />
          {cleaningFeeCents > 0 && <Row label="Taxa de limpeza" value={formatCurrency(cleaningFeeCents)} />}
          {extraGuestTotal > 0 && (
            <Row
              label={`Hóspedes adicionais (${guests - extraGuestAfter} × ${nights}n)`}
              value={formatCurrency(extraGuestTotal)}
            />
          )}
          <div className="flex justify-between pt-2 border-t border-brand-100">
            <span className="font-semibold text-gray-900">Total</span>
            <span className="font-bold text-gray-900">{formatCurrency(subTotal)}</span>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={goToBooking}
        disabled={!datesValid || availability.state !== "available"}
        className="w-full py-3.5 rounded-xl bg-gradient-to-br from-brand-500 to-brand-600 hover:to-brand-700 text-brand-100 font-semibold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-none disabled:bg-gray-200 disabled:text-gray-400 mb-2"
      >
        {instantBooking ? "Reservar agora" : "Solicitar reserva"}
      </button>

      <a
        href={whatsappUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="w-full inline-flex items-center justify-center gap-2 py-3 rounded-xl border border-brand-200 text-gray-600 hover:bg-gray-50 text-sm font-medium"
      >
        <MessageCircle size={14} /> Falar pelo WhatsApp
      </a>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-gray-600">
      <span>{label}</span>
      <span className="font-mono">{value}</span>
    </div>
  );
}
