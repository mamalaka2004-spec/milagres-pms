import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Catálogo de imóveis à venda.
 *
 * A mesma tabela alimenta três consumidores: a Sarah (tool consultar_imoveis),
 * o site público /venda e o editor em Vendas › Imóveis. As leituras públicas
 * filtram por `publicado`; o editor enxerga tudo.
 */

export type ImovelVenda = {
  id: string;
  unit_code: string;
  slug: string | null;
  property_id: string | null;
  nome: string;
  condominio: string | null;
  preco: number;
  area_m2: number | null;
  suites: number | null;
  hospedes: number | null;
  localizacao: string | null;
  distancia_praia: string | null;
  descricao: string | null;
  diferenciais: string | null;
  beneficios: string[];
  fotos: string[];
  foto_capa: string | null;
  tag: string | null;
  video_url: string | null;
  airbnb_url: string | null;
  publicado: boolean;
  disponivel: boolean;
  ordem: number;
};

const COLS =
  "id, unit_code, slug, property_id, nome, condominio, preco, area_m2, suites, hospedes, " +
  "localizacao, distancia_praia, descricao, diferenciais, beneficios, fotos, foto_capa, " +
  "tag, video_url, airbnb_url, publicado, disponivel, ordem";

/** Imóveis visíveis no site público, na ordem definida pelo time. */
export async function listImoveisPublicados(): Promise<ImovelVenda[]> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("imoveis_milagres")
    .select(COLS)
    .eq("publicado", true)
    .eq("disponivel", true)
    .order("ordem", { ascending: true })
    .order("preco", { ascending: true });
  if (error) throw error;
  return (data as unknown as ImovelVenda[]) ?? [];
}

/** Um imóvel publicado, por slug. `null` quando não existe ou está fora do ar. */
export async function getImovelPublicadoBySlug(slug: string): Promise<ImovelVenda | null> {
  const db = createAdminClient();
  const { data } = await db
    .from("imoveis_milagres")
    .select(COLS)
    .eq("slug", slug)
    .eq("publicado", true)
    .eq("disponivel", true)
    .maybeSingle();
  return (data as unknown as ImovelVenda | null) ?? null;
}

/** Todos os imóveis, publicados ou não — a listagem do editor. */
export async function listImoveisParaEdicao(): Promise<ImovelVenda[]> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("imoveis_milagres")
    .select(COLS)
    .order("ordem", { ascending: true })
    .order("preco", { ascending: true });
  if (error) throw error;
  return (data as unknown as ImovelVenda[]) ?? [];
}

export async function getImovelById(id: string): Promise<ImovelVenda | null> {
  const db = createAdminClient();
  const { data } = await db.from("imoveis_milagres").select(COLS).eq("id", id).maybeSingle();
  return (data as unknown as ImovelVenda | null) ?? null;
}

export type ImovelVendaPatch = Partial<
  Pick<
    ImovelVenda,
    | "nome" | "condominio" | "preco" | "area_m2" | "suites" | "hospedes"
    | "localizacao" | "distancia_praia" | "descricao" | "beneficios"
    | "fotos" | "foto_capa" | "tag" | "video_url" | "airbnb_url"
    | "publicado" | "ordem" | "slug"
  >
>;

export async function updateImovelVenda(
  id: string,
  patch: ImovelVendaPatch,
): Promise<ImovelVenda> {
  const db = createAdminClient();
  // Mesmo cast usado nas outras escritas do projeto (campaign.ts, checklists.ts):
  // os tipos gerados resolvem o payload de update para `never`.
  const { data, error } = await (db.from("imoveis_milagres") as any) // eslint-disable-line @typescript-eslint/no-explicit-any
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select(COLS)
    .single();
  if (error) throw error;
  return data as unknown as ImovelVenda;
}

/**
 * Todas as fotos que o imóvel tem no bucket — a bandeja de onde o editor
 * escolhe. Vem do Storage, não da tabela, então fotos novas enviadas ao
 * anúncio aparecem aqui sem precisar de migration.
 */
export async function listFotosDisponiveis(propertyId: string): Promise<string[]> {
  const db = createAdminClient();
  const prefixo = `properties/${propertyId}`;
  const { data, error } = await db.storage
    .from("property-images")
    .list(prefixo, { limit: 200, sortBy: { column: "name", order: "asc" } });
  if (error) throw error;

  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return (data ?? [])
    .filter((o) => o.name && !o.name.startsWith("."))
    .map((o) => `${base}/storage/v1/object/public/property-images/${prefixo}/${o.name}`);
}

export function precoBRL(valor: number): string {
  return valor.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
}
