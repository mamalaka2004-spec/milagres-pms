import type { MetadataRoute } from "next";
import { listImoveisPublicados } from "@/lib/db/queries/imoveis-venda";

/**
 * Só o site de vendas entra no sitemap. O PMS é privado e as páginas de
 * locação (/p/[slug]) têm ciclo próprio — se um dia forem indexadas, entram
 * aqui também.
 */

export const dynamic = "force-dynamic";

function baseUrl(): string {
  const url = process.env.NEXT_PUBLIC_APP_URL || "https://milagres-pms.vercel.app";
  return url.replace(/\/$/, "");
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = baseUrl();

  let imoveis: Awaited<ReturnType<typeof listImoveisPublicados>> = [];
  try {
    imoveis = await listImoveisPublicados();
  } catch {
    // Sem banco, o sitemap ainda responde com o índice.
  }

  return [
    {
      url: `${base}/venda`,
      changeFrequency: "weekly",
      priority: 1,
    },
    ...imoveis
      .filter((im) => im.slug)
      .map((im) => ({
        url: `${base}/venda/${im.slug}`,
        changeFrequency: "weekly" as const,
        priority: 0.8,
      })),
  ];
}
