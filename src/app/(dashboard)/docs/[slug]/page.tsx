import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ChevronLeft } from "lucide-react";
import { requirePageAuth } from "@/lib/auth";
import { DOC_PAGES, getDocPage } from "@/lib/docs/content";
import { Markdown } from "@/components/docs/markdown";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const doc = getDocPage(slug);
  return { title: doc ? `${doc.title} · Documentação` : "Documentação" };
}

export default async function DocArticlePage({ params }: PageProps) {
  await requirePageAuth();
  const { slug } = await params;
  const doc = getDocPage(slug);
  if (!doc) notFound();

  const idx = DOC_PAGES.findIndex((d) => d.slug === slug);
  const prev = idx > 0 ? DOC_PAGES[idx - 1] : null;
  const next = idx < DOC_PAGES.length - 1 ? DOC_PAGES[idx + 1] : null;

  return (
    <div className="mx-auto max-w-3xl space-y-4 lg:space-y-6">
      <Link
        href="/docs"
        className="inline-flex items-center gap-1 rounded text-xs text-gray-500 transition-colors duration-200 hover:text-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40"
      >
        <ChevronLeft size={12} aria-hidden="true" /> Documentação
      </Link>

      <div>
        <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-500">
          {doc.category}
        </div>
        <h1 className="mt-1 font-heading text-3xl font-normal text-gray-900">{doc.title}</h1>
        <p className="mt-1 text-sm text-gray-500">{doc.description}</p>
      </div>

      <article className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm lg:p-8">
        <Markdown content={doc.body} />
      </article>

      {/* Navegação entre páginas */}
      <div className="flex items-stretch justify-between gap-3">
        {prev ? (
          <Link
            href={`/docs/${prev.slug}`}
            className="flex-1 rounded-xl border border-gray-200 bg-white p-3 text-left shadow-sm transition-colors duration-200 hover:border-brand-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40"
          >
            <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Anterior</div>
            <div className="truncate text-sm font-semibold text-gray-800">{prev.title}</div>
          </Link>
        ) : (
          <div className="flex-1" />
        )}
        {next ? (
          <Link
            href={`/docs/${next.slug}`}
            className="flex-1 rounded-xl border border-gray-200 bg-white p-3 text-right shadow-sm transition-colors duration-200 hover:border-brand-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40"
          >
            <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Próxima</div>
            <div className="truncate text-sm font-semibold text-gray-800">{next.title}</div>
          </Link>
        ) : (
          <div className="flex-1" />
        )}
      </div>
    </div>
  );
}
