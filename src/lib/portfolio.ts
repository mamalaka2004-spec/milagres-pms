/**
 * Portfólio de vendas — índice das apresentações.
 *
 * ARQUIVO GERADO. Não edite à mão: saída de `scripts/portfolio/build.py`,
 * que também produz os HTMLs e PDFs em `public/portfolio/`.
 * Para mudar preços ou incluir um imóvel, edite o script e rode:
 *     python3 scripts/portfolio/build.py --pdf
 */

const BUCKET =
  "https://xmmuenaaodlqubfotwzr.supabase.co/storage/v1/object/public/property-images/properties";

export type PortfolioDeck = {
  slug: string;
  nome: string;
  condominio: string;
  area: string;
  suites: number;
  hospedes: number;
  preco: number;
  /** Mesma foto de capa usada no deck do imóvel. */
  capa: string;
  alt: string;
};

export const PORTFOLIO_GERAL = {
  slug: "portfolio-milagres",
  titulo: "Seis imóveis na Rota Ecológica",
  resumo:
    "10 slides: a região, o portfólio completo com a composição do VGV e uma ficha por imóvel.",
};

export const PORTFOLIO_DECKS: PortfolioDeck[] = [
  {
    slug: "tamona07",
    nome: "Tamoná 07",
    condominio: "Villa Tamoná",
    area: "57 m²",
    suites: 2,
    hospedes: 6,
    preco: 720000,
    capa: `${BUCKET}/3a4ef8d9-cff3-4601-92b3-a04d3300294d/airbnb-00-1782183397126.jpg`,
    alt: "Piscina privativa do Tamoná 07 ao lado da sala envidraçada",
  },
  {
    slug: "villagreen",
    nome: "Villa Green",
    condominio: "Essence · unidade B001",
    area: "70 m²",
    suites: 2,
    hospedes: 6,
    preco: 850000,
    capa: `${BUCKET}/0430151c-73b5-4a7b-860c-dfd56dde924f/airbnb-02-1782183591729.jpg`,
    alt: "Piscina do Essence com deck de madeira, coqueiros e o mar ao fundo",
  },
  {
    slug: "tamona18",
    nome: "Tamoná 18",
    condominio: "Villa Tamoná",
    area: "83 m²",
    suites: 2,
    hospedes: 6,
    preco: 890000,
    capa: `${BUCKET}/4de8b1ce-b543-41b8-a3ad-ba8bbf09ab2f/airbnb-00-1777425365936.jpg`,
    alt: "Piscina privativa no rooftop do Tamoná 18, com coqueiral e céu aberto",
  },
  {
    slug: "cotinguiba08",
    nome: "Cotinguiba 08",
    condominio: "Villa Cotinguiba",
    area: "103 m²",
    suites: 2,
    hospedes: 6,
    preco: 890000,
    capa: `${BUCKET}/06a8bfdd-c58c-494e-b813-868d5b147e59/airbnb-00-1777495979629.jpg`,
    alt: "Piscina privativa do Cotinguiba 08 com deck de madeira e fecho de bambu",
  },
  {
    slug: "duplex116",
    nome: "Duplex 116",
    condominio: "Villa Kanui",
    area: "155 m²",
    suites: 3,
    hospedes: 10,
    preco: 1250000,
    capa: `${BUCKET}/ee88c020-9974-40de-8cab-e2aa833e1f56/airbnb-00-1782183521993.jpg`,
    alt: "Piscina privativa do Duplex 116 integrada à área gourmet e à sala envidraçada",
  },
  {
    slug: "marbella",
    nome: "Cobertura Mar Bella",
    condominio: "Villa Kanui · unidade 201",
    area: "Cobertura",
    suites: 3,
    hospedes: 10,
    preco: 2200000,
    capa: `${BUCKET}/833b16b6-3e3c-4f88-a80b-92a6c548ba0c/airbnb-05-1777496302920.jpg`,
    alt: "Varanda gourmet da Cobertura Mar Bella com mesa posta para oito, piscina, rede e coqueiral ao fundo",
  },
];

export function formatBRL(valor: number): string {
  return valor.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
}
