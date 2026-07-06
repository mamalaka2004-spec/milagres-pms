/**
 * Templates de site (#29 — Fase 10). Base extensível: novos templates entram
 * aqui e ficam disponíveis no seletor da aba Site. Hoje só o tema atual da
 * landing ("sage") está pronto; os demais são placeholders para evoluir.
 */
export interface SiteTemplate {
  id: string;
  name: string;
  description: string;
  /** Cor de destaque só para o preview do card no painel. */
  swatch: string;
  available: boolean;
}

export const SITE_TEMPLATES: SiteTemplate[] = [
  {
    id: "sage",
    name: "Sage (padrão)",
    description: "Tema atual da Milagres — verde-sálvia, tipografia serifada e clima litorâneo.",
    swatch: "#6B7F5E",
    available: true,
  },
  {
    id: "coastal",
    name: "Coastal",
    description: "Variação clara e arejada, foco em fotos grandes. Em breve.",
    swatch: "#4A7C8C",
    available: false,
  },
  {
    id: "minimal",
    name: "Minimal",
    description: "Layout minimalista, preto & branco, ideal para portfólios. Em breve.",
    swatch: "#2A3424",
    available: false,
  },
];

export const DEFAULT_TEMPLATE_ID = "sage";

export function getTemplate(id: string | null | undefined): SiteTemplate {
  return SITE_TEMPLATES.find((t) => t.id === id) || SITE_TEMPLATES[0];
}
