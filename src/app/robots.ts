import type { MetadataRoute } from "next";

/**
 * Abre só o site de vendas para os buscadores. Todo o resto — PMS, APIs,
 * material interno em /portfolio — fica de fora.
 */

function baseUrl(): string {
  const url = process.env.NEXT_PUBLIC_APP_URL || "https://milagres-pms.vercel.app";
  return url.replace(/\/$/, "");
}

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        // `/venda$` fecha o índice sem liberar /vendas* (o PMS), que casaria
        // por prefixo se a regra fosse só "/venda".
        allow: ["/venda$", "/venda/"],
        disallow: [
          "/",
          "/api/",
          "/portfolio/",
          "/dashboard",
          "/vendas",
          "/settings",
          "/login",
        ],
      },
    ],
    sitemap: `${baseUrl()}/sitemap.xml`,
  };
}
