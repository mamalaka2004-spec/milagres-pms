import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requirePageAuth } from "@/lib/auth";
import { getImovelById, listFotosDisponiveis } from "@/lib/db/queries/imoveis-venda";
import { ImovelEditor } from "@/components/sales/imovel-editor";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditarImovelPage({ params }: PageProps) {
  await requirePageAuth();
  const { id } = await params;

  const imovel = await getImovelById(id);
  if (!imovel) notFound();

  // Bandeja de fotos: tudo que o imóvel tem no bucket, mesmo o que ainda não
  // foi escolhido. Se ele não estiver ligado a uma property, cai para o que
  // já está selecionado.
  let disponiveis: string[] = imovel.fotos;
  if (imovel.property_id) {
    try {
      const doBucket = await listFotosDisponiveis(imovel.property_id);
      if (doBucket.length) disponiveis = doBucket;
    } catch {
      // Bucket fora do ar: o editor ainda funciona com as fotos já salvas.
    }
  }

  return (
    <div className="space-y-4">
      <Link
        href="/vendas/imoveis"
        className="inline-flex items-center gap-1.5 text-xs text-gray-500 transition-colors hover:text-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40"
      >
        <ArrowLeft size={14} aria-hidden="true" />
        Imóveis à venda
      </Link>

      <ImovelEditor imovel={imovel} fotosDisponiveis={disponiveis} />
    </div>
  );
}
