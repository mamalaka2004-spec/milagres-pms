import Link from "next/link";
import type { Metadata } from "next";
import { MapPin, Ruler, Users } from "lucide-react";
import { listImoveisPublicados, precoBRL } from "@/lib/db/queries/imoveis-venda";
import { SiteHeader, SiteFooter } from "@/components/public/site-header";

export const dynamic = "force-dynamic";

const WHATSAPP = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "5582999999999";
const WHATSAPP_URL = `https://wa.me/${WHATSAPP}`;

export const metadata: Metadata = {
  title: "Imóveis à venda em São Miguel dos Milagres | Milagres Hospedagens",
  description:
    "Apartamentos e coberturas à venda na Rota Ecológica dos Milagres — prontos, " +
    "mobiliados e com operação de locação por temporada já ativa.",
  alternates: { canonical: "/venda" },
  openGraph: {
    type: "website",
    title: "Imóveis à venda na Rota Ecológica dos Milagres",
    description:
      "Prontos, mobiliados e com locação por temporada já rodando. São Miguel dos " +
      "Milagres e Porto de Pedras, litoral norte de Alagoas.",
  },
};

export default async function VendaIndexPage() {
  const imoveis = await listImoveisPublicados();

  const precos = imoveis.map((i) => i.preco);
  const entrada = precos.length ? Math.min(...precos) : 0;

  return (
    <div className="min-h-screen bg-cream font-body">
      <SiteHeader whatsappUrl={WHATSAPP_URL} />

      <section className="px-4 pb-10 pt-28 md:px-8 md:pt-32">
        <div className="mx-auto max-w-6xl">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.3em] text-brand-500">
            Imóveis à venda
          </p>
          <h1 className="max-w-3xl font-heading text-4xl font-normal leading-tight text-gray-900 md:text-6xl">
            Um imóvel pronto na Rota Ecológica
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-gray-600 md:text-lg">
            Mobiliados, decorados e com operação de locação por temporada já rodando —
            para uso próprio, segunda residência ou investimento com renda desde o
            primeiro mês. São Miguel dos Milagres e Porto de Pedras, litoral norte de
            Alagoas.
          </p>
          {imoveis.length > 0 && (
            <p className="mt-5 font-mono text-sm tabular-nums text-gray-500">
              {imoveis.length} {imoveis.length === 1 ? "imóvel disponível" : "imóveis disponíveis"} ·
              a partir de <span className="text-gray-900">{precoBRL(entrada)}</span>
            </p>
          )}
        </div>
      </section>

      <section className="px-4 pb-20 md:px-8">
        <div className="mx-auto max-w-6xl">
          {imoveis.length === 0 ? (
            <p className="rounded-xl border border-brand-200 bg-white p-8 text-center text-gray-500">
              Nenhum imóvel disponível no momento.{" "}
              <a href={WHATSAPP_URL} className="text-brand-600 underline">
                Fale com a gente
              </a>{" "}
              para saber das próximas oportunidades.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {imoveis.map((im) => (
                <Link
                  key={im.id}
                  href={`/venda/${im.slug}`}
                  className="group flex flex-col overflow-hidden rounded-2xl border border-brand-200/70 bg-white shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-lg motion-reduce:transform-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/50"
                >
                  <div className="relative aspect-[4/3] overflow-hidden bg-brand-100">
                    {im.foto_capa && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={im.foto_capa}
                        alt={im.nome}
                        loading="lazy"
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105 motion-reduce:transform-none"
                      />
                    )}
                    {im.tag && (
                      <span className="absolute left-0 top-4 bg-cream/95 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-brand-700">
                        {im.tag}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-1 flex-col p-5">
                    {im.condominio && (
                      <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-brand-500">
                        {im.condominio}
                      </span>
                    )}
                    <h2 className="mt-1 font-heading text-2xl font-normal leading-tight text-gray-900">
                      {im.nome}
                    </h2>

                    {im.localizacao && (
                      <p className="mt-1.5 inline-flex items-center gap-1 text-xs text-gray-500">
                        <MapPin size={12} className="text-brand-400" aria-hidden="true" />
                        {[im.localizacao, im.distancia_praia].filter(Boolean).join(" · ")}
                      </p>
                    )}

                    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 font-mono text-xs tabular-nums text-gray-500">
                      {im.area_m2 && (
                        <span className="inline-flex items-center gap-1">
                          <Ruler size={12} className="text-brand-400" aria-hidden="true" />
                          {im.area_m2} m²
                        </span>
                      )}
                      {im.suites && <span>{im.suites} suítes</span>}
                      {im.hospedes && (
                        <span className="inline-flex items-center gap-1">
                          <Users size={12} className="text-brand-400" aria-hidden="true" />
                          {im.hospedes}
                        </span>
                      )}
                    </div>

                    <p className="mt-auto pt-4 font-mono text-lg font-medium tabular-nums text-gray-900">
                      {precoBRL(im.preco)}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      <SiteFooter whatsappUrl={WHATSAPP_URL} />
    </div>
  );
}
