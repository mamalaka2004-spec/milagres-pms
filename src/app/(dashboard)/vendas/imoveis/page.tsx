import Link from "next/link";
import { Building2, ExternalLink, Eye, EyeOff, Pencil } from "lucide-react";
import { requirePageAuth } from "@/lib/auth";
import { listImoveisParaEdicao, precoBRL } from "@/lib/db/queries/imoveis-venda";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Imóveis à venda",
  description: "Edite descrição, preço e fotos dos imóveis publicados no site de vendas.",
};

export default async function ImoveisVendaPage() {
  await requirePageAuth();
  const imoveis = await listImoveisParaEdicao();

  const publicados = imoveis.filter((i) => i.publicado).length;

  return (
    <div className="space-y-4 lg:space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-600">
            <Building2 size={16} className="text-white" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 lg:text-2xl">Imóveis à venda</h1>
            <p className="text-xs text-gray-500">
              {publicados} de {imoveis.length} publicados no site
            </p>
          </div>
        </div>
        <a
          href="/venda"
          target="_blank"
          rel="noopener"
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40"
        >
          <ExternalLink size={14} aria-hidden="true" />
          Ver o site
        </a>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {imoveis.map((im) => (
          <article
            key={im.id}
            className="flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm"
          >
            <div className="relative aspect-[16/10] bg-gray-100">
              {im.foto_capa && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={im.foto_capa}
                  alt={im.nome}
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
              )}
              <span
                className={`absolute right-2 top-2 inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-semibold ${
                  im.publicado
                    ? "bg-brand-600 text-white"
                    : "bg-gray-900/70 text-white"
                }`}
              >
                {im.publicado ? (
                  <>
                    <Eye size={11} aria-hidden="true" /> No ar
                  </>
                ) : (
                  <>
                    <EyeOff size={11} aria-hidden="true" /> Rascunho
                  </>
                )}
              </span>
            </div>

            <div className="flex flex-1 flex-col gap-1 p-4">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-brand-600">
                {im.condominio}
              </span>
              <h2 className="font-semibold leading-tight text-gray-900">{im.nome}</h2>
              <p className="text-xs text-gray-500">
                {[im.area_m2 && `${im.area_m2} m²`, im.suites && `${im.suites} suítes`, `${im.fotos.length} fotos`]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              <p className="mt-1 font-mono text-sm font-medium tabular-nums text-gray-900">
                {precoBRL(im.preco)}
              </p>

              <div className="mt-3 flex gap-2 border-t border-gray-100 pt-3">
                <Link
                  href={`/vendas/imoveis/${im.id}`}
                  className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40"
                >
                  <Pencil size={13} aria-hidden="true" />
                  Editar
                </Link>
                {im.publicado && im.slug && (
                  <a
                    href={`/venda/${im.slug}`}
                    target="_blank"
                    rel="noopener"
                    className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40"
                  >
                    <ExternalLink size={13} aria-hidden="true" />
                  </a>
                )}
              </div>
            </div>
          </article>
        ))}
      </div>

      {imoveis.length === 0 && (
        <p className="rounded-xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">
          Nenhum imóvel cadastrado em <code className="font-mono">imoveis_milagres</code>.
        </p>
      )}
    </div>
  );
}
