import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Calendar as CalendarIcon,
  Users as UsersIcon,
  Star,
  Pencil,
  ExternalLink,
} from "lucide-react";
import { getReservationById } from "@/lib/db/queries/reservations";
import { requirePageAuth } from "@/lib/auth";
import {
  formatCurrency,
  formatDate,
  formatPhone,
} from "@/lib/utils/format";
import { PageHeader, Section, Button, StatusBadge } from "@/components/ui";
import { FinancialBreakdown } from "@/components/reservations/financial-breakdown";
import { ChannelCard } from "@/components/reservations/channel-card";
import { StatusActions } from "@/components/reservations/status-actions";
import { DeleteReservationButton } from "@/components/reservations/delete-reservation-button";
import { PaymentForm } from "@/components/finance/payment-form";
import { ChargeButton } from "@/components/finance/charge-button";

export const dynamic = "force-dynamic";

const PAYMENT_ROW_STATUS: Record<string, string> = {
  pending: "Pendente",
  completed: "Pago",
  failed: "Falhou",
  refunded: "Reembolsado",
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ReservationDetailPage({ params }: PageProps) {
  const user = await requirePageAuth();
  const { id } = await params;

  let r;
  try {
    r = await getReservationById(id);
  } catch {
    notFound();
  }
  if (!r || r.company_id !== user.company_id) notFound();

  const { property, guest, payments } = r;

  const totalPaid = payments
    .filter((p) => p.status === "completed")
    .reduce((sum, p) => sum + p.amount_cents, 0);
  const balance = r.total_cents - totalPaid;

  return (
    <div className="space-y-4 lg:space-y-6 max-w-5xl mx-auto">
      <PageHeader
        backHref="/reservations"
        backLabel="Voltar para reservas"
        eyebrow={r.booking_code}
        title={property?.name}
        badges={
          <>
            <StatusBadge type="reservation" value={r.status} />
            <StatusBadge type="payment" value={r.payment_status} />
            <StatusBadge type="channel" value={r.channel} />
          </>
        }
        actions={
          <Button asChild variant="secondary">
            <Link href={`/reservations/${r.id}/edit`}>
              <Pencil size={14} aria-hidden="true" />
              Editar
            </Link>
          </Button>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          {/* Stay info */}
          <Section title="Hospedagem">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <KV
                icon={CalendarIcon}
                label="Check-in"
                value={formatDate(r.check_in_date)}
                hint={property?.check_in_time?.slice(0, 5)}
              />
              <KV
                icon={CalendarIcon}
                label="Check-out"
                value={formatDate(r.check_out_date)}
                hint={property?.check_out_time?.slice(0, 5)}
              />
              <KV
                label="Noites"
                value={String(r.nights)}
              />
              <KV
                icon={UsersIcon}
                label="Hóspedes"
                value={`${r.num_guests}`}
                hint={`${r.num_adults} adultos · ${r.num_children} crianças`}
              />
            </div>
            {(r.special_requests || r.internal_notes) && (
              <div className="mt-4 space-y-3">
                {r.special_requests && (
                  <NotesBlock label="Solicitações especiais" value={r.special_requests} />
                )}
                {r.internal_notes && (
                  <NotesBlock label="Notas internas" value={r.internal_notes} />
                )}
              </div>
            )}
            {r.cancellation_reason && (
              <div className="mt-3 p-3 rounded bg-red-50 border border-red-200 text-sm text-red-700">
                <div className="text-[11px] font-semibold uppercase tracking-wider mb-1">
                  Motivo do cancelamento
                </div>
                {r.cancellation_reason}
              </div>
            )}
          </Section>

          {/* Financials */}
          <Section title="Financeiro">
            <FinancialBreakdown
              input={{
                base_amount_cents: r.base_amount_cents,
                cleaning_fee_cents: r.cleaning_fee_cents,
                extra_guest_fee_cents: r.extra_guest_fee_cents,
                discount_cents: r.discount_cents,
                platform_fee_cents: r.platform_fee_cents,
                tax_cents: r.tax_cents,
                nights: r.nights,
              }}
            />
            <div className="grid grid-cols-2 gap-3 mt-3">
              <KV
                label="Pago"
                value={formatCurrency(totalPaid)}
                tone="positive"
              />
              <KV
                label="Saldo"
                value={formatCurrency(balance)}
                tone={balance > 0 ? "danger" : "positive"}
              />
            </div>
          </Section>

          {/* Payments */}
          <Section title={`Pagamentos (${payments.length})`}>
            <div className="mb-3">
              <PaymentForm
                reservationId={r.id}
                suggestedAmount={Math.max(0, balance) / 100}
              />
              <ChargeButton reservationId={r.id} balanceCents={balance} />
            </div>
            {payments.length === 0 ? (
              <div className="text-sm text-gray-400 py-4 text-center">
                Nenhum pagamento registrado ainda.
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {payments.map((p) => (
                  <div key={p.id} className="py-2.5 flex justify-between items-start gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-gray-900">
                        {p.method.toUpperCase()}
                        <span className="ml-2 text-[10px] uppercase font-bold tracking-wider text-gray-400">
                          {PAYMENT_ROW_STATUS[p.status] || p.status}
                        </span>
                        {p.gateway === "asaas" && (
                          <span className="ml-1.5 text-[9px] uppercase font-bold tracking-wider text-brand-600 bg-brand-500/10 px-1 py-0.5 rounded">Asaas</span>
                        )}
                      </div>
                      {p.reference && (
                        <div className="text-xs text-gray-500 font-mono">{p.reference}</div>
                      )}
                      {p.due_date && p.status === "pending" && (
                        <div className="text-xs text-gray-400">vence {formatDate(p.due_date)}</div>
                      )}
                      {p.paid_at && (
                        <div className="text-xs text-gray-400">
                          {formatDate(p.paid_at, "dd/MM/yyyy HH:mm")}
                        </div>
                      )}
                      {p.invoice_url && (
                        <a href={p.invoice_url} target="_blank" rel="noopener noreferrer" className="text-xs text-brand-700 hover:text-brand-800 font-semibold inline-flex items-center gap-1 mt-0.5">
                          <ExternalLink size={11} aria-hidden="true" /> Abrir fatura
                        </a>
                      )}
                      {p.notes && (
                        <div className="text-xs text-gray-500 mt-0.5">{p.notes}</div>
                      )}
                    </div>
                    <div className="font-mono text-sm font-semibold">
                      {formatCurrency(p.amount_cents)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Section>
        </div>

        <div className="space-y-4">
          {/* Guest panel */}
          <Section title="Hóspede">
            {guest ? (
              <div className="space-y-2">
                <Link
                  href={`/guests/${guest.id}`}
                  className="font-semibold text-base text-gray-900 hover:text-brand-600 inline-flex items-center gap-2 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40 rounded"
                >
                  {guest.full_name}
                  {guest.is_vip && (
                    <Star size={12} className="text-amber-500" fill="currentColor" aria-hidden="true" />
                  )}
                </Link>
                {guest.email && <div className="text-xs text-gray-600">{guest.email}</div>}
                {guest.phone && (
                  <div className="text-xs text-gray-600 font-mono">
                    {formatPhone(guest.phone)}
                  </div>
                )}
                {guest.document_number && (
                  <div className="text-xs text-gray-500">
                    {guest.document_type?.toUpperCase()}: {guest.document_number}
                  </div>
                )}
                <div className="pt-2 border-t border-gray-100 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <div className="text-gray-400">Hospedagens</div>
                    <div className="font-semibold text-gray-900">{guest.total_stays}</div>
                  </div>
                  <div>
                    <div className="text-gray-400">Gasto</div>
                    <div className="font-semibold text-gray-900 font-mono">
                      {formatCurrency(guest.total_spent_cents)}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-sm text-gray-400">Hóspede não encontrado.</div>
            )}
          </Section>

          {/* Channel */}
          <ChannelCard
            channel={r.channel}
            channelRef={r.channel_ref}
            platformFeeCents={r.platform_fee_cents}
            netAmountCents={r.net_amount_cents}
            listingUrl={
              r.channel === "airbnb"
                ? property?.airbnb_listing_url ?? null
                : r.channel === "booking"
                ? property?.booking_listing_url ?? null
                : null
            }
            lastSyncedAt={
              r.channel === "airbnb"
                ? property?.airbnb_last_synced_at ?? null
                : r.channel === "booking"
                ? property?.booking_last_synced_at ?? null
                : null
            }
          />

          {/* Status actions */}
          <Section title="Ações">
            <StatusActions reservationId={r.id} currentStatus={r.status} />
            <div className="pt-3 mt-3 border-t border-gray-100">
              <DeleteReservationButton reservationId={r.id} />
            </div>
          </Section>

          {/* Property panel */}
          {property && (
            <Section title="Imóvel">
              <Link
                href={`/properties/${property.id}`}
                className="block hover:opacity-90 transition-opacity duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40 rounded"
              >
                <div className="font-semibold text-sm text-gray-900">{property.name}</div>
                <div className="font-mono text-[11px] text-gray-400">{property.code}</div>
                <div className="text-xs text-gray-500 mt-1">
                  Até {property.max_guests} hóspedes
                </div>
              </Link>
            </Section>
          )}

          {/* Timeline */}
          <Section title="Linha do tempo">
            <div className="space-y-2 text-xs text-gray-600">
              <Tick label="Criada" at={r.created_at} />
              {r.confirmed_at && <Tick label="Confirmada" at={r.confirmed_at} />}
              {r.checked_in_at && <Tick label="Check-in" at={r.checked_in_at} />}
              {r.checked_out_at && <Tick label="Check-out" at={r.checked_out_at} />}
              {r.canceled_at && <Tick label="Cancelada" at={r.canceled_at} tone="red" />}
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}

function KV({
  icon: Icon,
  label,
  value,
  hint,
  tone,
}: {
  icon?: React.ElementType;
  label: string;
  value: string;
  hint?: string;
  tone?: "positive" | "danger";
}) {
  return (
    <div>
      <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-0.5 inline-flex items-center gap-1">
        {Icon && <Icon size={10} aria-hidden="true" />}
        {label}
      </div>
      <div
        className={`font-semibold text-base ${
          tone === "positive" ? "text-green-700" : tone === "danger" ? "text-red-600" : "text-gray-900"
        }`}
      >
        {value}
      </div>
      {hint && <div className="text-[11px] text-gray-400 font-mono">{hint}</div>}
    </div>
  );
}

function NotesBlock({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
        {label}
      </div>
      <div className="text-sm text-gray-700 whitespace-pre-wrap bg-gray-50 rounded p-3 border border-gray-100">
        {value}
      </div>
    </div>
  );
}

function Tick({ label, at, tone }: { label: string; at: string; tone?: "red" }) {
  return (
    <div className="flex justify-between gap-2">
      <span className={tone === "red" ? "text-red-600" : "text-gray-700"}>{label}</span>
      <span className="font-mono text-gray-500">{formatDate(at, "dd/MM HH:mm")}</span>
    </div>
  );
}
