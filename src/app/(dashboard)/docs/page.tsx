import Link from "next/link";
import {
  BookOpen, ChevronRight, LayoutDashboard, Layers, Boxes, Database, ShieldCheck, Server,
  type LucideIcon,
} from "lucide-react";
import { requirePageAuth } from "@/lib/auth";
import { DOC_PAGES } from "@/lib/docs/content";

export const dynamic = "force-dynamic";

const ICONS: Record<string, LucideIcon> = {
  LayoutDashboard, Layers, Boxes, Database, ShieldCheck, Server, BookOpen,
};

export default async function DocsPage() {
  await requirePageAuth();

  // Agrupa por categoria mantendo a ordem de definição.
  const categories: string[] = [];
  for (const d of DOC_PAGES) if (!categories.includes(d.category)) categories.push(d.category);

  return (
    <div className="space-y-4 lg:space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-600">
          <BookOpen size={16} className="text-white" aria-hidden="true" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900 lg:text-2xl">Documentação</h1>
          <p className="text-xs text-gray-500">Arquitetura, stack e informações do sistema</p>
        </div>
      </div>

      {categories.map((cat) => (
        <section key={cat} className="space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400">{cat}</h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {DOC_PAGES.filter((d) => d.category === cat).map((d) => {
              const Icon = ICONS[d.icon] || BookOpen;
              return (
                <Link
                  key={d.slug}
                  href={`/docs/${d.slug}`}
                  className="group flex items-start gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md motion-reduce:transform-none motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-500/10">
                    <Icon className="text-brand-600" size={18} aria-hidden="true" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1 text-sm font-semibold text-gray-900">
                      {d.title}
                      <ChevronRight
                        size={14}
                        className="text-gray-300 transition-colors duration-200 group-hover:text-brand-500"
                        aria-hidden="true"
                      />
                    </div>
                    <p className="mt-0.5 text-xs text-gray-500">{d.description}</p>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
