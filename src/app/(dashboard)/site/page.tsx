import Link from "next/link";
import { Globe, ExternalLink, Home, FileText, ArrowUpRight } from "lucide-react";
import { requirePageAuth } from "@/lib/auth";
import { listActivePublicProperties } from "@/lib/db/queries/properties";
import { getSiteSettings } from "@/lib/db/queries/site";
import { SiteSettingsForm } from "@/components/site/site-settings-form";

export const dynamic = "force-dynamic";

export default async function SitePage() {
  const user = await requirePageAuth();
  const canManage = user.role === "admin" || user.role === "manager";

  const [properties, settings] = await Promise.all([
    listActivePublicProperties(),
    getSiteSettings(user.company_id),
  ]);

  return (
    <div className="space-y-4 lg:space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-600">
          <Globe size={16} className="text-white" aria-hidden="true" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900 lg:text-2xl">Site</h1>
          <p className="text-xs text-gray-500">Landing pública e páginas dos imóveis</p>
        </div>
      </div>

      {/* Status + acesso ao site */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <div className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm lg:col-span-2">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-gray-900">Landing pública</div>
            <p className="mt-0.5 text-xs text-gray-500">
              A página inicial do site, com todos os imóveis publicados.
            </p>
          </div>
          <a
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white transition-colors duration-200 hover:bg-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40"
          >
            <ExternalLink size={15} aria-hidden="true" /> Abrir site
          </a>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="font-heading text-3xl font-semibold text-brand-600">{properties.length}</div>
          <div className="text-xs font-medium uppercase tracking-wider text-gray-500">
            {properties.length === 1 ? "Imóvel publicado" : "Imóveis publicados"}
          </div>
        </div>
      </div>

      {/* Configuração (admin/gerente) */}
      {canManage && (
        <section className="space-y-3">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-gray-900">Configuração</h2>
            <p className="text-xs text-gray-500">
              Base da landing pública. A persistência requer a migration{" "}
              <code className="rounded bg-gray-100 px-1 py-0.5 font-mono text-[11px]">035_site_settings</code>.
            </p>
          </div>
          <SiteSettingsForm initial={settings} />
        </section>
      )}

      {/* Imóveis no site */}
      <section className="space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-wider text-gray-900">Imóveis no site</h2>
        {properties.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-400">
            Nenhum imóvel publicado ainda. Ative um imóvel (status &quot;active&quot;) para exibi-lo no site.
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <ul className="divide-y divide-gray-100">
              {properties.map((p) => (
                <li key={p.id} className="flex items-center gap-3 p-3 sm:p-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-500/10">
                    <Home size={16} className="text-brand-600" aria-hidden="true" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-gray-900">{p.name}</div>
                    <div className="truncate font-mono text-[11px] text-gray-400">/p/{p.slug}</div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <a
                      href={`/p/${p.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-semibold text-gray-600 transition-colors duration-200 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40"
                      title="Abrir página pública"
                    >
                      <ArrowUpRight size={13} aria-hidden="true" /> Página
                    </a>
                    <a
                      href={`/apresentacao/${p.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-semibold text-gray-600 transition-colors duration-200 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40"
                      title="Gerar apresentação (PDF)"
                    >
                      <FileText size={13} aria-hidden="true" /> Apresentação
                    </a>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}
