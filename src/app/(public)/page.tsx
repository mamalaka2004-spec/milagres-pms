import Link from "next/link";
import { Leaf, MessageCircle, ArrowRight, Users, BedDouble, Bath, Star, Home, Sparkles, TreePine } from "lucide-react";
import { listActivePublicProperties } from "@/lib/db/queries/properties";
import { formatCurrency } from "@/lib/utils/format";
import { SiteHeader, SiteFooter } from "@/components/public/site-header";

export const dynamic = "force-dynamic";

const WHATSAPP_URL = `https://wa.me/${process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "5582999999999"}`;

export default async function HomePage() {
  const properties = await listActivePublicProperties();

  return (
    <div className="min-h-screen bg-cream font-body">
      <SiteHeader transparent whatsappUrl={WHATSAPP_URL} />

      {/* Hero */}
      <section className="relative h-[85vh] min-h-[500px] md:h-screen md:min-h-[700px] overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-brand-700 via-brand-600 to-brand-400" />
        <div className="absolute inset-0 bg-gradient-to-b from-brand-800/50 via-brand-700/30 to-brand-800/70" />
        <div className="relative z-10 h-full flex flex-col items-center justify-center text-center px-6">
          <div className="w-12 h-12 rounded-full bg-brand-100/15 border border-brand-100/20 flex items-center justify-center mb-7 backdrop-blur-sm">
            <Leaf size={22} className="text-brand-100" strokeWidth={1.5} />
          </div>
          <h1 className="font-heading text-4xl sm:text-5xl md:text-6xl lg:text-[64px] font-normal leading-[1.05] text-brand-100 max-w-3xl mb-4 tracking-tight">
            Sua estadia perfeita em{" "}
            <span className="italic font-medium">São Miguel dos Milagres</span>
          </h1>
          <p className="font-body text-sm md:text-base text-brand-100/80 max-w-md mx-auto mb-10 leading-relaxed font-light">
            Propriedades exclusivas no litoral mais bonito do Brasil.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto justify-center">
            <a
              href="#properties"
              className="px-8 py-4 sm:py-3.5 rounded-full bg-brand-100 text-brand-700 font-semibold text-sm shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all"
            >
              Explorar Propriedades
            </a>
            <a
              href={WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="px-8 py-4 sm:py-3.5 rounded-full bg-brand-100/10 hover:bg-brand-100/20 border border-brand-100/30 text-brand-100 font-medium text-sm inline-flex items-center justify-center gap-2 backdrop-blur-sm transition"
            >
              <MessageCircle size={16} /> Falar Conosco
            </a>
          </div>
        </div>
      </section>

      {/* Properties */}
      <section id="properties" className="py-16 md:py-24 px-4 md:px-8 bg-cream">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12 md:mb-16">
            <div className="text-[11px] font-semibold tracking-[0.3em] uppercase text-brand-500 mb-3">
              Nossas Propriedades
            </div>
            <h2 className="font-heading text-3xl md:text-5xl text-gray-900 font-normal leading-tight mb-3">
              Cada espaço, uma <span className="italic">experiência</span>
            </h2>
            <p className="text-sm text-gray-500 max-w-md mx-auto leading-relaxed">
              Propriedades selecionadas para oferecer conforto e momentos únicos no litoral norte de Alagoas.
            </p>
          </div>

          {properties.length === 0 ? (
            <div className="text-center py-20 text-gray-400">
              Em breve: novas propriedades serão publicadas aqui.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-7">
              {properties.map((p) => {
                const cover =
                  p.property_images?.find((i) => i.is_cover) || p.property_images?.[0];
                const coverUrl = cover?.url || p.cover_image_url;
                return (
                  <Link
                    key={p.id}
                    href={`/p/${p.slug}`}
                    className="group bg-white rounded-2xl overflow-hidden border border-brand-200/40 hover:shadow-[0_16px_40px_rgba(74,90,64,0.1)] hover:-translate-y-1 transition-all"
                  >
                    <div className="relative h-44 md:h-56 bg-gradient-to-br from-brand-300 to-brand-600 overflow-hidden">
                      {coverUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={coverUrl}
                          alt={p.name}
                          className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-500"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-5xl">
                          🏡
                        </div>
                      )}
                      {p.instant_booking_enabled && (
                        <span className="absolute top-3 left-3 inline-flex items-center px-2.5 py-1 rounded-full bg-green-500/90 text-white text-[9px] font-bold uppercase tracking-wider">
                          Instant booking
                        </span>
                      )}
                    </div>
                    <div className="p-5 md:p-6">
                      <h3 className="font-heading text-xl md:text-2xl font-medium text-gray-900 mb-1">
                        {p.name}
                      </h3>
                      {p.subtitle && (
                        <p className="text-xs text-gray-500 mb-4 line-clamp-1">{p.subtitle}</p>
                      )}
                      <div className="flex gap-4 mb-5 text-xs text-gray-500">
                        <span className="inline-flex items-center gap-1">
                          <Users size={13} className="text-brand-400" /> {p.max_guests}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <BedDouble size={13} className="text-brand-400" /> {p.bedrooms}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Bath size={13} className="text-brand-400" /> {p.bathrooms}
                        </span>
                      </div>
                      <div className="flex justify-between items-baseline pt-4 border-t border-brand-100">
                        <div>
                          {p.base_price_cents > 0 ? (
                            <>
                              <span className="font-heading text-2xl font-semibold text-brand-600">
                                {formatCurrency(p.base_price_cents)}
                              </span>
                              <span className="text-[11px] text-gray-400"> /noite</span>
                            </>
                          ) : (
                            <span className="text-xs font-semibold text-brand-600">
                              Consultar valores
                            </span>
                          )}
                        </div>
                        <span className="inline-flex items-center gap-1 text-brand-500 text-sm font-medium">
                          Ver <ArrowRight size={14} />
                        </span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* Value props */}
      <section className="py-16 md:py-24 px-4 md:px-8 bg-white">
        <div className="max-w-4xl mx-auto text-center">
          <div className="text-[11px] font-semibold tracking-[0.3em] uppercase text-brand-500 mb-3">
            Por que escolher
          </div>
          <h2 className="font-heading text-3xl md:text-5xl text-gray-900 font-normal mb-12">
            Hospitalidade com <span className="italic">alma</span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12">
            {[
              {
                icon: Home,
                t: "Propriedades Selecionadas",
                d: "Cada imóvel escolhido por qualidade e conforto.",
              },
              {
                icon: Sparkles,
                t: "Experiência Completa",
                d: "Check-in simplificado, suporte dedicado, dicas locais.",
              },
              {
                icon: TreePine,
                t: "Natureza & Tranquilidade",
                d: "Entre coqueirais e o mar mais cristalino do Nordeste.",
              },
            ].map((v) => (
              <div key={v.t}>
                <div className="w-14 h-14 rounded-xl bg-brand-50 flex items-center justify-center mx-auto mb-4">
                  <v.icon size={26} className="text-brand-500" strokeWidth={1.5} />
                </div>
                <h3 className="font-heading text-xl font-medium text-gray-900 mb-2">{v.t}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{v.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 md:py-24 px-4 md:px-8 bg-brand-50/40">
        <div className="max-w-3xl mx-auto text-center">
          <Star size={20} className="mx-auto text-brand-500 fill-brand-500 mb-4" />
          <h2 className="font-heading text-3xl md:text-4xl font-normal text-gray-900 mb-3">
            Pronto para uma estadia inesquecível?
          </h2>
          <p className="text-sm text-gray-500 mb-8 max-w-md mx-auto">
            Reserve direto com a gente. Atendimento humano, sem taxas de plataforma.
          </p>
          <a
            href={WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-full bg-brand-500 hover:bg-brand-600 text-brand-100 font-semibold text-sm shadow-lg transition"
          >
            <MessageCircle size={16} /> Conversar pelo WhatsApp
          </a>
        </div>
      </section>

      <SiteFooter whatsappUrl={WHATSAPP_URL} />
    </div>
  );
}
