import {
  MapPin, Users, BedDouble, Bath, Clock, Leaf, MessageCircle,
  BadgeCheck, Shield, Home,
} from "lucide-react";
import type { PropertyWithRelations } from "@/lib/db/queries/properties";
import { formatCurrency } from "@/lib/utils/format";
import { PrintButton } from "./print-button";

/** Rótulos PT para as categorias de comodidades (mesmo conjunto do seletor). */
const CATEGORY_LABELS: Record<string, string> = {
  general: "Geral",
  kitchen: "Cozinha",
  bathroom: "Banheiro",
  bedroom: "Quarto",
  outdoor: "Área externa",
  safety: "Segurança",
  entertainment: "Entretenimento",
  accessibility: "Acessibilidade",
};

const TYPE_LABELS: Record<string, string> = {
  house: "Casa",
  apartment: "Apartamento",
  chalet: "Chalé",
  bungalow: "Bangalô",
  villa: "Vila",
  studio: "Studio",
  flat: "Flat",
  room: "Quarto",
};

interface PropertyPresentationProps {
  property: PropertyWithRelations;
  /** Mostra a seção de valores (padrão true). Desligue p/ apresentações sem preço. */
  showPricing?: boolean;
  whatsappUrl: string;
}

export function PropertyPresentation({
  property,
  showPricing = true,
  whatsappUrl,
}: PropertyPresentationProps) {
  const images = [...(property.property_images || [])].sort((a, b) => {
    if (a.is_cover !== b.is_cover) return a.is_cover ? -1 : 1;
    return (a.sort_order ?? 0) - (b.sort_order ?? 0);
  });
  const cover = property.cover_image_url || images.find((i) => i.is_cover)?.url || images[0]?.url || null;
  const galleryImages = images.filter((i) => i.url !== cover).slice(0, 6);

  const amenities = (property.property_amenities || []).map((pa) => pa.amenity).filter(Boolean);
  const grouped: Record<string, typeof amenities> = {};
  for (const a of amenities) {
    const cat = a.category || "general";
    (grouped[cat] ||= []).push(a);
  }

  const location = [property.neighborhood, property.city, property.state].filter(Boolean).join(", ");
  const typeLabel = property.type ? TYPE_LABELS[property.type] || property.type : null;

  const facts = [
    { icon: Users, label: "Hóspedes", value: property.max_guests },
    { icon: BedDouble, label: property.bedrooms === 1 ? "Quarto" : "Quartos", value: property.bedrooms },
    { icon: Home, label: property.beds === 1 ? "Cama" : "Camas", value: property.beds },
    { icon: Bath, label: property.bathrooms === 1 ? "Banheiro" : "Banheiros", value: property.bathrooms },
  ];

  return (
    <div className="min-h-screen bg-brand-50/50 font-body text-gray-800 print:bg-white">
      {/* Print styles — dependency-free "PDF" via window.print() */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
          @media print {
            @page { size: A4; margin: 12mm; }
            html, body { background: #ffffff !important; }
            .no-print { display: none !important; }
            .print-doc { box-shadow: none !important; margin: 0 !important; max-width: none !important; border-radius: 0 !important; }
            .avoid-break { break-inside: avoid; page-break-inside: avoid; }
            .break-before { break-before: page; page-break-before: always; }
            * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
            a[href]::after { content: "" !important; }
          }
        `,
        }}
      />

      {/* Toolbar (não imprime) */}
      <div className="no-print sticky top-0 z-10 border-b border-brand-100 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-500">
              <Leaf size={14} className="text-brand-100" aria-hidden="true" />
            </span>
            <span className="font-semibold text-gray-700">Apresentação do imóvel</span>
          </div>
          <PrintButton />
        </div>
      </div>

      {/* Documento */}
      <article className="print-doc mx-auto my-6 max-w-4xl overflow-hidden rounded-2xl bg-white shadow-card print:my-0 print:shadow-none">
        {/* Cabeçalho */}
        <header className="avoid-break bg-gradient-to-br from-brand-600 to-brand-800 px-8 py-8 text-brand-100 print:py-6">
          <div className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.3em] text-brand-100/70">
            <Leaf size={14} aria-hidden="true" /> Milagres Hospedagens
          </div>
          <h1 className="font-heading text-4xl font-normal leading-tight md:text-5xl">{property.name}</h1>
          {property.subtitle && (
            <p className="mt-2 max-w-2xl text-base text-brand-100/85">{property.subtitle}</p>
          )}
          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-brand-100/80">
            {location && (
              <span className="inline-flex items-center gap-1.5">
                <MapPin size={15} aria-hidden="true" /> {location}
              </span>
            )}
            {typeLabel && (
              <span className="inline-flex items-center gap-1.5">
                <Home size={15} aria-hidden="true" /> {typeLabel}
              </span>
            )}
            <span className="font-mono text-xs tracking-wider text-brand-100/60">{property.code}</span>
          </div>
        </header>

        {/* Capa */}
        {cover && (
          <div className="avoid-break h-72 w-full overflow-hidden bg-brand-100 md:h-96">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={cover} alt={property.name} className="h-full w-full object-cover" />
          </div>
        )}

        <div className="space-y-8 px-8 py-8">
          {/* Fatos-chave */}
          <section className="avoid-break grid grid-cols-2 gap-3 md:grid-cols-4">
            {facts.map((f, i) => (
              <div key={i} className="rounded-xl border border-brand-100 bg-brand-50/40 p-4 text-center">
                <f.icon size={20} className="mx-auto mb-1.5 text-brand-500" aria-hidden="true" />
                <div className="font-heading text-2xl font-semibold text-gray-900">{f.value}</div>
                <div className="text-[11px] font-medium uppercase tracking-wider text-gray-500">{f.label}</div>
              </div>
            ))}
          </section>

          {/* Sobre */}
          {property.description && (
            <section className="avoid-break">
              <h2 className="mb-2 font-heading text-2xl font-normal text-gray-900">Sobre o espaço</h2>
              <p className="whitespace-pre-line leading-relaxed text-gray-600">{property.description}</p>
            </section>
          )}

          {/* Galeria */}
          {galleryImages.length > 0 && (
            <section className="avoid-break">
              <h2 className="mb-3 font-heading text-2xl font-normal text-gray-900">Fotos</h2>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                {galleryImages.map((img) => (
                  <div key={img.id} className="aspect-[4/3] overflow-hidden rounded-xl bg-brand-100">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={img.url}
                      alt={img.alt_text || property.name}
                      className="h-full w-full object-cover"
                    />
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Comodidades */}
          {amenities.length > 0 && (
            <section className="avoid-break">
              <h2 className="mb-3 font-heading text-2xl font-normal text-gray-900">Comodidades</h2>
              <div className="grid grid-cols-1 gap-x-8 gap-y-5 md:grid-cols-2">
                {Object.entries(grouped).map(([cat, items]) => (
                  <div key={cat}>
                    <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-brand-500">
                      {CATEGORY_LABELS[cat] || cat}
                    </div>
                    <ul className="space-y-1.5">
                      {items.map((a) => (
                        <li key={a.id} className="flex items-center gap-2 text-sm text-gray-700">
                          <BadgeCheck size={15} className="shrink-0 text-brand-400" aria-hidden="true" />
                          {a.name_pt || a.name}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Valores */}
          {showPricing && property.base_price_cents > 0 && (
            <section className="avoid-break rounded-2xl border border-brand-100 bg-brand-50/50 p-6">
              <h2 className="mb-4 font-heading text-2xl font-normal text-gray-900">Valores</h2>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div>
                  <div className="mb-1 text-[11px] uppercase tracking-wider text-gray-500">Diária a partir de</div>
                  <div className="font-heading text-3xl font-semibold text-brand-600">
                    {formatCurrency(property.base_price_cents)}
                    <span className="text-sm font-normal text-gray-400"> /noite</span>
                  </div>
                </div>
                {property.cleaning_fee_cents > 0 && (
                  <div>
                    <div className="mb-1 text-[11px] uppercase tracking-wider text-gray-500">Taxa de limpeza</div>
                    <div className="font-heading text-xl font-medium text-gray-800">
                      {formatCurrency(property.cleaning_fee_cents)}
                    </div>
                  </div>
                )}
                <div>
                  <div className="mb-1 text-[11px] uppercase tracking-wider text-gray-500">Estadia mínima</div>
                  <div className="font-heading text-xl font-medium text-gray-800">
                    {property.min_nights} {property.min_nights === 1 ? "noite" : "noites"}
                  </div>
                </div>
              </div>
              <p className="mt-3 text-xs text-gray-400">
                Valores sujeitos a alteração conforme temporada e disponibilidade.
              </p>
            </section>
          )}

          {/* Regras / horários */}
          {(property.house_rules || property.check_in_time || property.check_out_time) && (
            <section className="avoid-break">
              <h2 className="mb-3 font-heading text-2xl font-normal text-gray-900">Regras & horários</h2>
              <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                {property.check_in_time && (
                  <span className="inline-flex items-center gap-1.5 rounded-lg border border-brand-100 bg-brand-50/40 px-3 py-1.5">
                    <Clock size={13} className="text-brand-500" aria-hidden="true" /> Check-in{" "}
                    {property.check_in_time.slice(0, 5)}
                  </span>
                )}
                {property.check_out_time && (
                  <span className="inline-flex items-center gap-1.5 rounded-lg border border-brand-100 bg-brand-50/40 px-3 py-1.5">
                    <Clock size={13} className="text-brand-500" aria-hidden="true" /> Check-out{" "}
                    {property.check_out_time.slice(0, 5)}
                  </span>
                )}
              </div>
              {property.house_rules && (
                <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-gray-600">
                  {property.house_rules}
                </p>
              )}
            </section>
          )}

          {/* Cancelamento */}
          {property.cancellation_policy && (
            <section className="avoid-break">
              <h2 className="mb-2 inline-flex items-center gap-2 font-heading text-2xl font-normal text-gray-900">
                <Shield size={18} className="text-brand-500" aria-hidden="true" /> Política de cancelamento
              </h2>
              <p className="text-sm leading-relaxed text-gray-600">{property.cancellation_policy}</p>
            </section>
          )}
        </div>

        {/* Rodapé / contato */}
        <footer className="avoid-break border-t border-brand-100 bg-brand-700 px-8 py-8 text-brand-100">
          <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
            <div>
              <div className="font-heading text-2xl font-normal">Reserve direto com a gente</div>
              <p className="mt-1 text-sm text-brand-100/75">
                Atendimento humano, sem taxas de plataforma. Fale com a Milagres Hospedagens.
              </p>
            </div>
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex shrink-0 items-center gap-2 rounded-full bg-brand-100 px-6 py-3 text-sm font-semibold text-brand-700 transition-colors duration-200 hover:bg-white"
            >
              <MessageCircle size={16} aria-hidden="true" /> Falar no WhatsApp
            </a>
          </div>
          <div className="mt-6 border-t border-brand-600 pt-4 text-center text-[11px] text-brand-100/50">
            © {new Date().getFullYear()} Milagres Hospedagens · São Miguel dos Milagres, AL
          </div>
        </footer>
      </article>
    </div>
  );
}
