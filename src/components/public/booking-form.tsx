"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2, ChevronRight, Shield, MessageCircle } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils/format";

interface BookingFormProps {
  slug: string;
  propertyName: string;
  propertyImageUrl: string | null;
  basePriceCents: number;
  cleaningFeeCents: number;
  extraGuestFeeCents: number;
  extraGuestAfter: number;
  maxGuests: number;
  minNights: number;
  initial: {
    check_in_date: string;
    check_out_date: string;
    num_guests: number;
  };
  instantBooking: boolean;
  whatsappUrl: string;
}

export function BookingForm(props: BookingFormProps) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [country, setCountry] = useState("BR");
  const [requests, setRequests] = useState("");
  const [hp, setHp] = useState(""); // honeypot
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const ms =
    new Date(props.initial.check_out_date).getTime() - new Date(props.initial.check_in_date).getTime();
  const nights = Math.max(1, Math.round(ms / (24 * 60 * 60 * 1000)));

  const baseTotal = props.basePriceCents * nights;
  const extraGuestTotal =
    props.extraGuestAfter > 0 && props.initial.num_guests > props.extraGuestAfter
      ? props.extraGuestFeeCents * (props.initial.num_guests - props.extraGuestAfter) * nights
      : 0;
  const total = baseTotal + props.cleaningFeeCents + extraGuestTotal;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/booking/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: props.slug,
          check_in_date: props.initial.check_in_date,
          check_out_date: props.initial.check_out_date,
          num_guests: props.initial.num_guests,
          guest_full_name: name,
          guest_email: email,
          guest_phone: phone,
          guest_country: country,
          guest_language: "pt-BR",
          special_requests: requests || undefined,
          hp,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Erro ao processar reserva");
      const code = json.data.booking_code;
      const qs = new URLSearchParams({
        code,
        slug: props.slug,
        guest: name,
      });
      router.push(`/booking-success?${qs.toString()}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro");
      setSubmitting(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-10">
      {/* Form */}
      <form onSubmit={submit} className="lg:col-span-2 space-y-5">
        <div className="bg-white rounded-2xl border border-brand-100 p-5 md:p-6">
          <h2 className="font-heading text-2xl font-medium text-gray-900 mb-1">
            Quase lá! Conte para nós quem está chegando.
          </h2>
          <p className="text-sm text-gray-500 mb-5">
            Preencha seus dados — confirmamos por e-mail e WhatsApp em até 24 horas.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Nome completo *">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                minLength={2}
                className="form-input"
              />
            </Field>
            <Field label="E-mail *">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="form-input"
              />
            </Field>
            <Field label="WhatsApp / Telefone *">
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+55 82 99999-0000"
                required
                className="form-input"
              />
            </Field>
            <Field label="País">
              <input
                value={country}
                onChange={(e) => setCountry(e.target.value.toUpperCase().slice(0, 2))}
                placeholder="BR"
                maxLength={2}
                className="form-input uppercase"
              />
            </Field>
          </div>

          <div className="mt-4">
            <Field label="Pedidos especiais (opcional)">
              <textarea
                rows={3}
                value={requests}
                onChange={(e) => setRequests(e.target.value)}
                className="form-input"
                placeholder="Aniversário, alergias, horário especial de check-in..."
              />
            </Field>
          </div>

          {/* Honeypot */}
          <input
            type="text"
            tabIndex={-1}
            autoComplete="off"
            value={hp}
            onChange={(e) => setHp(e.target.value)}
            className="absolute opacity-0 w-0 h-0 -z-10"
            name="company"
          />
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting || !name || !email || !phone}
          className="w-full md:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 rounded-full bg-gradient-to-br from-brand-500 to-brand-600 hover:to-brand-700 text-brand-100 font-semibold text-sm transition disabled:opacity-50"
        >
          {submitting ? (
            <>
              <Loader2 size={16} className="animate-spin" /> Enviando reserva...
            </>
          ) : (
            <>
              {props.instantBooking ? "Confirmar reserva" : "Solicitar reserva"} <ChevronRight size={16} />
            </>
          )}
        </button>

        <a
          href={props.whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="block text-center text-sm text-gray-500 hover:text-brand-600"
        >
          <MessageCircle size={13} className="inline -mt-0.5 mr-1" /> Prefiro conversar pelo WhatsApp
        </a>

        <style jsx>{`
          :global(.form-input) {
            width: 100%;
            padding: 11px 14px;
            border-radius: 10px;
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

      {/* Summary */}
      <aside className="lg:col-span-1">
        <div className="lg:sticky lg:top-24 bg-white rounded-2xl border border-brand-100 overflow-hidden">
          <div className="aspect-[4/3] bg-brand-100">
            {props.propertyImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={props.propertyImageUrl}
                alt={props.propertyName}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-5xl">🏡</div>
            )}
          </div>
          <div className="p-5 space-y-3">
            <h3 className="font-heading text-xl font-medium text-gray-900">{props.propertyName}</h3>

            <div className="space-y-1.5 text-sm border-t border-brand-100 pt-3">
              <div className="flex justify-between">
                <span className="text-gray-500">Check-in</span>
                <span className="font-mono font-semibold">
                  {formatDate(props.initial.check_in_date)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Check-out</span>
                <span className="font-mono font-semibold">
                  {formatDate(props.initial.check_out_date)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Hóspedes</span>
                <span className="font-semibold">{props.initial.num_guests}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Noites</span>
                <span className="font-semibold">{nights}</span>
              </div>
            </div>

            <div className="space-y-1.5 text-sm border-t border-brand-100 pt-3">
              <Row label={`R$ ${(props.basePriceCents / 100).toFixed(0)} × ${nights} noites`} value={formatCurrency(baseTotal)} />
              {props.cleaningFeeCents > 0 && (
                <Row label="Taxa de limpeza" value={formatCurrency(props.cleaningFeeCents)} />
              )}
              {extraGuestTotal > 0 && (
                <Row
                  label={`Hóspedes adicionais`}
                  value={formatCurrency(extraGuestTotal)}
                />
              )}
            </div>

            <div className="flex justify-between text-base font-bold pt-3 border-t border-brand-100">
              <span>Total</span>
              <span>{formatCurrency(total)}</span>
            </div>

            <div className="flex items-start gap-2 pt-3 text-xs text-gray-500">
              <Shield size={12} className="text-brand-500 mt-0.5 shrink-0" />
              <span>
                {props.instantBooking
                  ? "Confirmação imediata após verificação de pagamento."
                  : "Resposta da nossa equipe em até 24 horas. Sem cobrança neste momento."}
              </span>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[11px] font-semibold text-gray-500 uppercase tracking-[0.18em] mb-1.5">
        {label}
      </span>
      {children}
    </label>
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
