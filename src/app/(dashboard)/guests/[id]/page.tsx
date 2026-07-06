import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Mail, Phone, Globe, Star, Pencil } from "lucide-react";
import { getGuestById } from "@/lib/db/queries/guests";
import { requirePageAuth } from "@/lib/auth";
import { formatCurrency, formatPhone, formatDate } from "@/lib/utils/format";
import {
  ReservationStatusBadge,
  PaymentStatusBadge,
} from "@/components/shared/status-badges";
import { GuestDeleteButton } from "@/components/guests/guest-delete-button";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function GuestDetailPage({ params }: PageProps) {
  const user = await requirePageAuth();
  const { id } = await params;

  let guest;
  try {
    guest = await getGuestById(id);
  } catch {
    notFound();
  }
  if (!guest || guest.company_id !== user.company_id) notFound();

  const sorted = [...(guest.reservations || [])].sort(
    (a, b) =>
      new Date(b.check_in_date).getTime() - new Date(a.check_in_date).getTime()
  );

  return (
    <div className="space-y-4 lg:space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-3">
        <Link href="/guests" aria-label="Voltar para hóspedes" className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40">
          <ArrowLeft size={18} aria-hidden="true" />
        </Link>
        <div className="flex-1">
          <h1 className="text-xl lg:text-2xl font-bold text-gray-900 inline-flex items-center gap-2">
            {guest.full_name}
            {guest.is_vip && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">
                <Star size={10} aria-hidden="true" fill="currentColor" /> VIP
              </span>
            )}
          </h1>
          {guest.tags && guest.tags.length > 0 && (
            <div className="flex gap-1 mt-1 flex-wrap">
              {guest.tags.map((t) => (
                <span
                  key={t}
                  className="text-[10px] uppercase tracking-wider bg-gray-100 text-gray-600 px-2 py-0.5 rounded"
                >
                  {t}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-start gap-2 flex-shrink-0">
          <Link
            href={`/guests/${guest.id}/edit`}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 text-gray-600 font-semibold text-sm hover:bg-gray-50 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40"
          >
            <Pencil size={16} aria-hidden="true" /> Editar
          </Link>
          <GuestDeleteButton guestId={guest.id} guestName={guest.full_name} />
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Total de estadias" value={String(guest.total_stays)} />
        <Stat label="Total gasto" value={formatCurrency(guest.total_spent_cents)} />
        <Stat label="País" value={guest.country || guest.nationality || "—"} />
        <Stat label="Idioma" value={guest.language} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-3 lg:col-span-1">
          <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400">
            Contato
          </h2>
          <Field icon={Mail} label="E-mail" value={guest.email || "—"} />
          <Field
            icon={Phone}
            label="Telefone"
            value={guest.phone ? formatPhone(guest.phone) : "—"}
            mono
          />
          <Field
            icon={Globe}
            label="De"
            value={
              [guest.city, guest.state, guest.country].filter(Boolean).join(", ") || "—"
            }
          />
          {guest.document_number && (
            <Field
              label={guest.document_type?.toUpperCase() || "Documento"}
              value={guest.document_number}
            />
          )}
          {guest.date_of_birth && (
            <Field label="Data de nascimento" value={formatDate(guest.date_of_birth)} />
          )}
          {guest.notes && (
            <div className="pt-2 border-t border-gray-100">
              <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
                Observações
              </div>
              <div className="text-sm text-gray-700 whitespace-pre-wrap">
                {guest.notes}
              </div>
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 lg:col-span-2">
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400">
              Histórico de estadias ({sorted.length})
            </h2>
            <Link
              href={`/reservations/new?guest_id=${guest.id}`}
              className="text-xs font-semibold text-brand-600 hover:text-brand-700 transition-colors duration-200 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40"
            >
              + Nova reserva
            </Link>
          </div>
          {sorted.length === 0 ? (
            <div className="text-sm text-gray-400 py-8 text-center">
              Nenhuma reserva ainda para este hóspede.
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {sorted.map((r) => (
                <Link
                  key={r.id}
                  href={`/reservations/${r.id}`}
                  className="block py-3 hover:bg-gray-50 -mx-2 px-2 rounded transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40"
                >
                  <div className="flex justify-between items-start gap-2 flex-wrap">
                    <div className="min-w-0">
                      <div className="font-mono text-xs text-gray-500">{r.booking_code}</div>
                      <div className="font-semibold text-sm text-gray-900 truncate">
                        {r.property?.name || "—"}
                      </div>
                      <div className="text-xs text-gray-500">
                        {formatDate(r.check_in_date)} → {formatDate(r.check_out_date)} ·{" "}
                        {r.nights} {r.nights === 1 ? "noite" : "noites"}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="font-mono text-sm font-semibold text-gray-900">
                        {formatCurrency(r.total_cents)}
                      </span>
                      <ReservationStatusBadge status={r.status} />
                      <PaymentStatusBadge status={r.payment_status} />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
      <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
        {label}
      </div>
      <div className="text-lg font-bold text-gray-900 mt-1">{value}</div>
    </div>
  );
}

function Field({
  icon: Icon,
  label,
  value,
  mono = false,
}: {
  icon?: React.ElementType;
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-0.5">
        {label}
      </div>
      <div
        className={`text-sm text-gray-700 inline-flex items-center gap-2 ${
          mono ? "font-mono" : ""
        }`}
      >
        {Icon && <Icon size={14} aria-hidden="true" className="text-gray-400" />}
        {value}
      </div>
    </div>
  );
}
