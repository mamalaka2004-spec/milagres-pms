import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Edit, Users, BedDouble, Bath, MapPin, Clock, BadgeDollarSign, UserCheck } from "lucide-react";
import { getPropertyById } from "@/lib/db/queries/properties";
import { getPropertyPricingContext } from "@/lib/db/queries/pricing";
import { requirePageAuth } from "@/lib/auth";
import { formatCurrency } from "@/lib/utils/format";
import { RULE_KIND_LABELS } from "@/types/pricing";
import { PhotoGallery } from "@/components/properties/photo-gallery";
import { AmenitySelector } from "@/components/properties/amenity-selector";
import { ChannelSyncPanel } from "@/components/properties/channel-sync-panel";
import MarketPanel from "@/components/properties/market-panel";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function PropertyDetailPage({ params }: PageProps) {
  const user = await requirePageAuth();
  const { id } = await params;

  let property;
  try {
    property = await getPropertyById(id);
  } catch {
    notFound();
  }

  if (!property || property.company_id !== user.company_id) {
    notFound();
  }

  const pricing = await getPropertyPricingContext(user.company_id, id);
  const owners = (property.property_ownership || []).filter((o) => o.owner && o.is_active);

  return (
    <div className="space-y-4 lg:space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <Link
            href="/properties"
            aria-label="Voltar para imóveis"
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40"
          >
            <ArrowLeft size={18} aria-hidden="true" />
          </Link>
          <div>
            <h1 className="text-xl lg:text-2xl font-bold text-gray-900">{property.name}</h1>
            <div className="text-xs text-gray-400 font-mono mt-0.5">{property.code}</div>
          </div>
        </div>
        <Link
          href={`/properties/${id}/edit`}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-500 hover:bg-brand-600 text-white font-semibold text-sm transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40"
        >
          <Edit size={15} aria-hidden="true" /> Editar
        </Link>
      </div>

      {/* Cover */}
      <div className="h-48 md:h-64 lg:h-80 rounded-2xl bg-gradient-to-br from-brand-300 to-brand-600 overflow-hidden">
        {property.cover_image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={property.cover_image_url} alt={property.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-6xl">🏡</div>
        )}
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { icon: Users, label: "Máx. de hóspedes", value: property.max_guests },
          { icon: BedDouble, label: "Quartos", value: property.bedrooms },
          { icon: BedDouble, label: "Camas", value: property.beds },
          { icon: Bath, label: "Banheiros", value: property.bathrooms },
        ].map((stat, i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
            <div className="flex items-center gap-2 text-gray-400 mb-1">
              <stat.icon size={14} aria-hidden="true" />
              <span className="text-xs font-medium uppercase tracking-wider">{stat.label}</span>
            </div>
            <div className="text-2xl font-bold text-gray-900">{stat.value}</div>
          </div>
        ))}
      </div>

      {/* Pricing */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 lg:p-6">
        <h2 className="text-sm font-bold text-gray-900 mb-4 uppercase tracking-wider">Preços</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <div className="text-xs text-gray-400 uppercase tracking-wider mb-1">Preço base</div>
            <div className="font-heading text-2xl text-brand-600">
              {formatCurrency(property.base_price_cents)}
              <span className="text-sm text-gray-400 font-body"> /noite</span>
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-400 uppercase tracking-wider mb-1">Taxa de limpeza</div>
            <div className="font-heading text-xl text-gray-700">
              {formatCurrency(property.cleaning_fee_cents)}
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-400 uppercase tracking-wider mb-1">Mín. / Máx. de noites</div>
            <div className="font-heading text-xl text-gray-700">
              {property.min_nights} / {property.max_nights}
            </div>
          </div>
        </div>
      </div>

      {/* Pricing rules (#9 — Fase 4) */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 lg:p-6">
        <div className="flex items-center justify-between gap-2 mb-4">
          <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Regras de precificação</h2>
          <Link
            href="/pricing"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-600 hover:text-brand-700"
          >
            <BadgeDollarSign size={13} aria-hidden="true" /> Gerenciar
          </Link>
        </div>
        {pricing.groups.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <span className="text-xs text-gray-400">Grupos:</span>
            {pricing.groups.map((g) => (
              <span
                key={g.id}
                className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-gray-50 px-2.5 py-0.5 text-xs font-medium text-gray-700"
              >
                <span className="h-2 w-2 rounded-full" style={{ background: g.color }} aria-hidden="true" />
                {g.name}
              </span>
            ))}
          </div>
        )}
        {pricing.rules.length === 0 ? (
          <p className="text-sm text-gray-400">
            Nenhuma regra afeta este imóvel — vale o preço base de {formatCurrency(property.base_price_cents)}/noite.
          </p>
        ) : (
          <ul className="divide-y divide-gray-50">
            {pricing.rules.map((rule) => (
              <li key={rule.id} className="flex items-center gap-3 py-2 text-sm">
                <span className="w-28 shrink-0 text-xs font-semibold uppercase tracking-wider text-gray-400">
                  {RULE_KIND_LABELS[rule.kind]}
                </span>
                <span className="flex-1 truncate text-gray-800">{rule.name}</span>
                <span className="font-mono text-xs text-gray-600">
                  {rule.adjustment_type === "set"
                    ? `${formatCurrency(rule.price_cents ?? 0)}/noite`
                    : `${Number(rule.percent ?? 0) > 0 ? "+" : ""}${Number(rule.percent ?? 0)}%`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Owners (#9 — vínculo via property_ownership) */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 lg:p-6">
        <div className="flex items-center justify-between gap-2 mb-4">
          <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Proprietários</h2>
          <Link
            href="/owners"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-600 hover:text-brand-700"
          >
            <UserCheck size={13} aria-hidden="true" /> Ver todos
          </Link>
        </div>
        {owners.length === 0 ? (
          <p className="text-sm text-gray-400">Nenhum proprietário vinculado a este imóvel.</p>
        ) : (
          <ul className="divide-y divide-gray-50">
            {owners.map((o) => (
              <li key={o.id} className="flex items-center gap-3 py-2.5 text-sm">
                <div className="flex-1 min-w-0">
                  <Link
                    href={`/owners/${o.owner!.id}`}
                    className="font-medium text-gray-900 hover:text-brand-600 truncate block"
                  >
                    {o.owner!.full_name}
                  </Link>
                  {o.owner!.email && <div className="text-xs text-gray-400 truncate">{o.owner!.email}</div>}
                </div>
                <div className="text-right text-xs text-gray-500">
                  <div>Participação: <strong className="font-mono">{o.share_percentage}%</strong></div>
                  <div>Comissão: <strong className="font-mono">{o.commission_percentage}%</strong></div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Location */}
      {(property.address || property.neighborhood || property.city) && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 lg:p-6">
          <h2 className="text-sm font-bold text-gray-900 mb-4 uppercase tracking-wider">Localização</h2>
          <div className="flex items-start gap-3 text-sm text-gray-600">
            <MapPin size={16} aria-hidden="true" className="text-brand-500 mt-0.5 shrink-0" />
            <div>
              {property.address && <div>{property.address}</div>}
              <div>
                {[property.neighborhood, property.city, property.state].filter(Boolean).join(", ")}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Description */}
      {property.description && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 lg:p-6">
          <h2 className="text-sm font-bold text-gray-900 mb-3 uppercase tracking-wider">Sobre</h2>
          <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">
            {property.description}
          </p>
        </div>
      )}

      {/* House Rules */}
      {property.house_rules && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 lg:p-6">
          <h2 className="text-sm font-bold text-gray-900 mb-3 uppercase tracking-wider">Regras da casa</h2>
          <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">{property.house_rules}</p>
          <div className="flex items-center gap-4 mt-4 pt-4 border-t border-gray-100 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <Clock size={12} aria-hidden="true" /> Check-in: {property.check_in_time}
            </span>
            <span className="flex items-center gap-1">
              <Clock size={12} aria-hidden="true" /> Check-out: {property.check_out_time}
            </span>
          </div>
        </div>
      )}

      {/* Photos */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 lg:p-6">
        <h2 className="text-sm font-bold text-gray-900 mb-4 uppercase tracking-wider">Fotos</h2>
        <PhotoGallery
          propertyId={property.id}
          initialImages={(property.property_images || []).map((img) => ({
            id: img.id,
            url: img.url,
            is_cover: img.is_cover || false,
            alt_text: img.alt_text,
          }))}
        />
      </div>

      {/* Amenities */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 lg:p-6">
        <h2 className="text-sm font-bold text-gray-900 mb-4 uppercase tracking-wider">Comodidades</h2>
        <AmenitySelector
          propertyId={property.id}
          initialSelectedIds={(property.property_amenities || []).map((pa) => pa.amenity.id)}
        />
      </div>

      {/* Channel Sync */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 lg:p-6">
        <h2 className="text-sm font-bold text-gray-900 mb-4 uppercase tracking-wider">Sincronização de canais</h2>
        <ChannelSyncPanel
          propertyId={property.id}
          airbnbIcalUrl={property.airbnb_ical_url}
          bookingIcalUrl={property.booking_ical_url}
          airbnbListingUrl={property.airbnb_listing_url}
          bookingListingUrl={property.booking_listing_url}
          airbnbLastSyncedAt={property.airbnb_last_synced_at}
          bookingLastSyncedAt={property.booking_last_synced_at}
        />
      </div>

      {/* Market analysis / suggested rate */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 lg:p-6">
        <div className="flex items-center justify-between gap-2 mb-4">
          <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Análise de mercado</h2>
          <span className="text-[11px] text-gray-400">Tarifa sugerida via GeckoAPI</span>
        </div>
        <MarketPanel
          propertyId={property.id}
          canRun={user.role === "admin" || user.role === "manager"}
          propertyName={property.name}
          propertyLat={property.latitude}
          propertyLng={property.longitude}
          propertyBedrooms={property.bedrooms}
        />
      </div>

      {/* Settings */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 lg:p-6">
        <h2 className="text-sm font-bold text-gray-900 mb-4 uppercase tracking-wider">Ajustes</h2>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Status</span>
            <span className="font-semibold text-gray-900 capitalize">{property.status}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Reserva instantânea</span>
            <span className="font-semibold text-gray-900">
              {property.instant_booking_enabled ? "Ativada" : "Desativada"}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Em destaque</span>
            <span className="font-semibold text-gray-900">
              {property.is_featured ? "Sim" : "Não"}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">URL pública</span>
            <span className="font-mono text-xs text-brand-600">/properties/{property.slug}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
