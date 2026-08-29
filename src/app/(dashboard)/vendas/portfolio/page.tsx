import Link from "next/link";
import { Download, ExternalLink, Images, Presentation } from "lucide-react";
import { requirePageAuth } from "@/lib/auth";
import { PORTFOLIO_DECKS, PORTFOLIO_GERAL, formatBRL } from "@/lib/portfolio";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Portfólio de vendas",
  description: "Apresentações dos imóveis à venda — geral e por imóvel, em HTML e PDF.",
};

export default async function PortfolioPage() {
  await requirePageAuth();

  const vgv = PORTFOLIO_DECKS.reduce((s, d) => s + d.preco, 0);

  return (
    <div className="space-y-4 lg:space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-600">
          <Presentation size={16} className="text-white" aria-hidden="true" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900 lg:text-2xl">Portfólio de vendas</h1>
          <p className="text-xs text-gray-500">
            {PORTFOLIO_DECKS.length} imóveis · VGV {formatBRL(vgv)} · material para o time comercial
          </p>
        </div>
      </div>

      {/* Deck geral */}
      <section className="space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400">
          Apresentação completa
        </h2>
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <h3 className="font-semibold text-gray-900">{PORTFOLIO_GERAL.titulo}</h3>
              <p className="mt-0.5 text-sm text-gray-500">{PORTFOLIO_GERAL.resumo}</p>
            </div>
            <div className="flex shrink-0 gap-2">
              <a
                href={`/portfolio/${PORTFOLIO_GERAL.slug}.html`}
                target="_blank"
                rel="noopener"
                className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40"
              >
                <ExternalLink size={14} aria-hidden="true" />
                Abrir
              </a>
              <a
                href={`/portfolio/pdf/${PORTFOLIO_GERAL.slug}.pdf`}
                download
                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40"
              >
                <Download size={14} aria-hidden="true" />
                PDF
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Um por imóvel */}
      <section className="space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400">
          Por imóvel
        </h2>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {PORTFOLIO_DECKS.map((d) => (
            <article
              key={d.slug}
              className="group flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md motion-reduce:transform-none motion-reduce:transition-none"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={d.capa}
                alt={d.alt}
                loading="lazy"
                className="h-40 w-full bg-gray-100 object-cover"
              />
              <div className="flex flex-1 flex-col gap-1 p-4">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-brand-600">
                  {d.condominio}
                </span>
                <h3 className="font-semibold leading-tight text-gray-900">{d.nome}</h3>
                <p className="text-xs text-gray-500">
                  {d.area} · {d.suites} suítes · {d.hospedes} hóspedes
                </p>
                <p className="mt-1 font-mono text-sm font-medium tabular-nums text-gray-900">
                  {formatBRL(d.preco)}
                </p>

                <div className="mt-3 flex gap-2 border-t border-gray-100 pt-3">
                  <a
                    href={`/portfolio/${d.slug}.html`}
                    target="_blank"
                    rel="noopener"
                    className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40"
                  >
                    <Images size={13} aria-hidden="true" />
                    Abrir
                  </a>
                  <a
                    href={`/portfolio/pdf/${d.slug}.pdf`}
                    download
                    className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40"
                  >
                    <Download size={13} aria-hidden="true" />
                    PDF
                  </a>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <p className="text-xs text-gray-400">
        Gerado por <code className="font-mono">scripts/portfolio/build.py</code> a partir de{" "}
        <code className="font-mono">docs/base-conhecimento/imoveis-venda-milagres.md</code>. Para
        atualizar preços ou textos, edite o script e rode{" "}
        <code className="font-mono">python3 scripts/portfolio/build.py --pdf</code>.{" "}
        <Link href="/vendas" className="underline hover:text-gray-600">
          Voltar para Vendas
        </Link>
      </p>
    </div>
  );
}
