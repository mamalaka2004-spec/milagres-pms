import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowLeft, Check, MapPin, PlayCircle, Ruler, Users } from "lucide-react";
import {
  getImovelPublicadoBySlug,
  listImoveisPublicados,
  precoBRL,
} from "@/lib/db/queries/imoveis-venda";
import { SiteHeader, SiteFooter } from "@/components/public/site-header";
import { PropertyGallery } from "@/components/public/property-gallery";
import { LeadForm } from "@/components/public/lead-form";

export const dynamic = "force-dynamic";

const WHATSAPP = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "5582999999999";
const WHATSAPP_URL = `https://wa.me/${WHATSAPP}`;

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const im = await getImovelPublicadoBySlug(slug);
  if (!im) return { title: "Imóvel não encontrado" };

  const onde = [im.localizacao, im.distancia_praia].filter(Boolean).join(" · ");
  const titulo = `${im.nome} — ${precoBRL(im.preco)} | Milagres Hospedagens`;
  const descricao =
    im.descricao ??
    `${im.area_m2 ?? ""} m², ${im.suites ?? ""} suítes em ${onde}. Pronto, mobiliado e com locação já ativa.`;

  return {
    title: titulo,
    description: descricao,
    alternates: { canonical: `/venda/${slug}` },
    openGraph: {
      type: "website",
      title: `${im.nome} — ${precoBRL(im.preco)}`,
      description: descricao,
      images: im.foto_capa ? [{ url: im.foto_capa, alt: im.nome }] : undefined,
    },
  };
}

export default async function ImovelVendaPage({ params }: PageProps) {
  const { slug } = await params;
  const im = await getImovelPublicadoBySlug(slug);
  if (!im) notFound();

  const outros = (await listImoveisPublicados()).filter((o) => o.id !== im.id).slice(0, 3);
  const onde = [im.localizacao, im.distancia_praia].filter(Boolean).join(" · ");

  const mensagem = encodeURIComponent(
    `Olá! Tenho interesse no ${im.nome} (${precoBRL(im.preco)}). Pode me passar mais detalhes?`,
  );

  // Rich result de imóvel — ajuda o Google a mostrar preço direto na busca.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Residence",
    name: im.nome,
    description: im.descricao ?? undefined,
    image: im.fotos.length ? im.fotos : undefined,
    address: {
      "@type": "PostalAddress",
      addressLocality: im.localizacao ?? "São Miguel dos Milagres",
      addressRegion: "AL",
      addressCountry: "BR",
    },
    numberOfRooms: im.suites ?? undefined,
    floorSize: im.area_m2
      ? { "@type": "QuantitativeValue", value: im.area_m2, unitCode: "MTK" }
      : undefined,
    offers: {
      "@type": "Offer",
      price: im.preco,
      priceCurrency: "BRL",
      availability: "https://schema.org/InStock",
    },
  };

  return (
    <div className="min-h-screen bg-cream font-body">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <SiteHeader whatsappUrl={WHATSAPP_URL} />

      <div className="px-4 pb-16 pt-24 md:px-8 md:pt-28">
        <div className="mx-auto max-w-6xl">
          <Link
            href="/venda"
            className="mb-6 inline-flex items-center gap-1.5 text-xs text-gray-500 transition-colors hover:text-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40"
          >
            <ArrowLeft size={14} aria-hidden="true" />
            Todos os imóveis
          </Link>

          {/* Título */}
          <div className="mb-6">
            {im.condominio && (
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.3em] text-brand-500">
                {im.condominio}
              </div>
            )}
            <h1 className="mb-2 font-heading text-3xl font-normal leading-tight text-gray-900 md:text-5xl">
              {im.nome}
            </h1>
            <div className="flex flex-wrap gap-3 text-sm text-gray-500">
              {onde && (
                <span className="inline-flex items-center gap-1">
                  <MapPin size={14} className="text-brand-500" aria-hidden="true" />
                  {onde}
                </span>
              )}
              {im.area_m2 && (
                <span className="inline-flex items-center gap-1">
                  <Ruler size={14} className="text-brand-400" aria-hidden="true" />
                  {im.area_m2} m²
                </span>
              )}
              {im.suites && <span>{im.suites} suítes</span>}
              {im.hospedes && (
                <span className="inline-flex items-center gap-1">
                  <Users size={14} className="text-brand-400" aria-hidden="true" />
                  até {im.hospedes} hóspedes
                </span>
              )}
            </div>
          </div>

          {/* Galeria — a ordem salva no editor é a ordem exibida. */}
          {im.fotos.length > 0 && (
            <PropertyGallery
              alt={im.nome}
              fallback={im.foto_capa}
              images={im.fotos.map((url, i) => ({
                id: `${im.id}-${i}`,
                url,
                alt_text: `${im.nome} — foto ${i + 1}`,
                is_cover: url === im.foto_capa,
                sort_order: i,
              }))}
            />
          )}

          <div className="mt-10 grid grid-cols-1 gap-10 lg:grid-cols-[1fr_360px]">
            {/* Conteúdo */}
            <div>
              {im.descricao && (
                <p className="text-base leading-relaxed text-gray-700 md:text-lg">
                  {im.descricao}
                </p>
              )}

              {im.beneficios.length > 0 && (
                <section className="mt-8">
                  <h2 className="mb-4 font-heading text-2xl font-normal text-gray-900">
                    O que faz este imóvel
                  </h2>
                  <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {im.beneficios.map((b) => (
                      <li key={b} className="flex items-start gap-2.5 text-sm text-gray-700">
                        <Check
                          size={16}
                          className="mt-0.5 shrink-0 text-brand-500"
                          aria-hidden="true"
                        />
                        {b}
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {im.diferenciais && (
                <section className="mt-8">
                  <h2 className="mb-3 font-heading text-2xl font-normal text-gray-900">
                    Entregue pronto
                  </h2>
                  <p className="text-sm leading-relaxed text-gray-600">{im.diferenciais}</p>
                </section>
              )}

              {(im.video_url || im.airbnb_url) && (
                <section className="mt-8 flex flex-wrap gap-3">
                  {im.video_url && (
                    <a
                      href={im.video_url}
                      target="_blank"
                      rel="noopener"
                      className="inline-flex items-center gap-2 rounded-xl border border-brand-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:border-brand-400 hover:text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40"
                    >
                      <PlayCircle size={16} className="text-brand-500" aria-hidden="true" />
                      Ver o vídeo do imóvel
                    </a>
                  )}
                  {im.airbnb_url && (
                    <a
                      href={im.airbnb_url}
                      target="_blank"
                      rel="noopener"
                      className="inline-flex items-center gap-2 rounded-xl border border-brand-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:border-brand-400 hover:text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40"
                    >
                      Ver o anúncio no Airbnb
                    </a>
                  )}
                </section>
              )}
            </div>

            {/* Preço + contato */}
            <aside className="lg:sticky lg:top-24 lg:self-start">
              <div className="rounded-2xl border border-brand-200 bg-white p-6 shadow-sm">
                <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-gray-400">
                  Valor de venda
                </div>
                <div className="mt-1 font-mono text-3xl font-medium tabular-nums text-gray-900">
                  {precoBRL(im.preco)}
                </div>
                <p className="mt-3 text-xs leading-relaxed text-gray-500">
                  Imóvel pronto, mobiliado e decorado, com anúncio ativo no Airbnb.
                  Condições de pagamento tratadas direto com o time comercial.
                </p>

                <a
                  href={`${WHATSAPP_URL}?text=${mensagem}`}
                  target="_blank"
                  rel="noopener"
                  className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/50"
                >
                  Falar sobre o {im.nome}
                </a>

                <div className="my-5 flex items-center gap-3">
                  <span className="h-px flex-1 bg-brand-100" />
                  <span className="text-[10px] uppercase tracking-[0.2em] text-gray-400">
                    ou deixe seu contato
                  </span>
                  <span className="h-px flex-1 bg-brand-100" />
                </div>

                <LeadForm imovelNome={im.nome} imovelSlug={im.slug ?? im.unit_code} />
              </div>
            </aside>
          </div>

          {/* Outros imóveis */}
          {outros.length > 0 && (
            <section className="mt-16 border-t border-brand-100 pt-10">
              <h2 className="mb-6 font-heading text-2xl font-normal text-gray-900">
                Outros imóveis à venda
              </h2>
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
                {outros.map((o) => (
                  <Link
                    key={o.id}
                    href={`/venda/${o.slug}`}
                    className="group overflow-hidden rounded-xl border border-brand-200/70 bg-white transition-all hover:-translate-y-0.5 hover:shadow-md motion-reduce:transform-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40"
                  >
                    {o.foto_capa && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={o.foto_capa}
                        alt={o.nome}
                        loading="lazy"
                        className="aspect-[3/2] w-full bg-brand-100 object-cover"
                      />
                    )}
                    <div className="p-4">
                      <h3 className="font-heading text-lg leading-tight text-gray-900">{o.nome}</h3>
                      <p className="mt-1 font-mono text-sm tabular-nums text-gray-600">
                        {precoBRL(o.preco)}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>

      <SiteFooter whatsappUrl={WHATSAPP_URL} />
    </div>
  );
}
