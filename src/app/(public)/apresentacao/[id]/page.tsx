import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getPropertyById } from "@/lib/db/queries/properties";
import { PropertyPresentation } from "@/components/presentation/property-presentation";

export const dynamic = "force-dynamic";

const WHATSAPP_URL = `https://wa.me/${process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "5582999999999"}`;

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ valores?: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  try {
    const property = await getPropertyById(id);
    if (property) {
      return {
        title: `${property.name} — Apresentação · Milagres Hospedagens`,
        description: property.subtitle || property.short_description || undefined,
      };
    }
  } catch {
    /* ignore — fall through to default */
  }
  return { title: "Apresentação do imóvel · Milagres Hospedagens" };
}

/**
 * Apresentação pública de um imóvel (#30). Link compartilhável por UUID —
 * pensado para enviar a proprietários e hóspedes. Uma página bem diagramada,
 * pronta para imprimir/salvar em PDF via o botão (window.print()) + CSS de
 * impressão. `?valores=nao` esconde a seção de preços (apresentações sem valor).
 */
export default async function PresentationPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const { valores } = await searchParams;

  let property;
  try {
    property = await getPropertyById(id);
  } catch {
    notFound();
  }
  if (!property) notFound();

  const showPricing = valores !== "nao" && valores !== "0" && valores !== "off";

  return (
    <PropertyPresentation property={property} showPricing={showPricing} whatsappUrl={WHATSAPP_URL} />
  );
}
