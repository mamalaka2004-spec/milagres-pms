// ===========================================================================
// Higiene de nomes do fonebook.
//
// Nomes vindos de exportações (Instagram, agenda) chegam como "@joao.silva",
// "MARIA IG 🌸", "Cliente 3" — se forem direto para {{primeiro_nome}} numa
// campanha, o lead recebe "Olá @joao.silva!". Aqui ficam a heurística barata
// (roda em todo mundo, sem custo) e a decisão de qual nome usar no envio.
// A IA (/api/contacts/ai-normalize) cuida só dos casos que a heurística não
// resolve com segurança.
// ===========================================================================

const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu;

/** Palavras que denunciam rótulo de origem, não nome de pessoa. */
const SOURCE_WORDS = [
  "insta", "instagram", "ig", "face", "facebook", "fb", "whats", "whatsapp", "wpp",
  "cliente", "lead", "contato", "site", "anuncio", "anúncio", "trafego", "tráfego",
  "olx", "airbnb", "booking", "indicacao", "indicação", "grupo",
];

/**
 * Marcadores de relacionamento/status que aparecem colados no nome na base
 * real ("Beth Campos Cliente", "BANIDA Daiane"). Não são nome — viram tag.
 */
export const RELATIONSHIP_MARKERS = [
  "cliente", "clientes", "banida", "banido", "pagante", "troca", "sorteio", "sorteios",
  "lista", "adm", "divulgação", "divulgacao", "part", "portaria", "réveillon", "reveillon",
  "espertinha", "esperta", "babaca", "invasora", "vaza tag", "rouba tag", "rouba grupo",
  "pilantra", "hóspede", "hospede", "proprietário", "proprietario", "fornecedor",
];

/** Termos que indicam PERFIL DE NEGÓCIO, não pessoa física. */
const BUSINESS_WORDS = [
  "store", "loja", "atelie", "ateliê", "atellie", "agencia", "agência", "blog", "oficial",
  "premios", "prêmios", "sorteios", "modas", "acessorios", "acessórios", "importados",
  "biquinis", "biquínis", "locacoes", "locações", "design", "studio", "estudio", "espaco",
  "espaço", "emporio", "empório", "receitas", "dicas", "mundo", "casa", "lar", "rede",
  "burger", "clinica", "clínica", "consultoria", "assessoria", "fotografia", "retratos",
  "makeup", "maquiagem", "crochet", "croche", "artes", "capas", "cosmeticos", "cosméticos",
];

export interface HandleInfo {
  /** Handle sem "@" e em minúsculas (ex.: "joao.silva"). */
  handle: string | null;
  /** Texto que sobra fora do handle — costuma ser o nome real. */
  rest: string;
}

/**
 * Separa o @handle do resto do texto. Na base real o nome verdadeiro
 * frequentemente vem DEPOIS do handle ("@amamaedavalen_ Renata").
 */
export function parseHandle(raw: string | null | undefined): HandleInfo {
  const s = (raw ?? "").trim();
  if (!s) return { handle: null, rest: "" };
  const match = s.match(/@([A-Za-z0-9._]{2,})/);
  const rest = s.replace(/@[A-Za-z0-9._]+/g, " ").replace(/\s+/g, " ").trim();
  return { handle: match ? match[1].toLowerCase() : null, rest };
}

/** Handle/nome que aparenta ser negócio (loja, ateliê, blog) e não pessoa. */
export function looksLikeBusiness(text: string | null | undefined): boolean {
  const s = (text ?? "").toLowerCase();
  if (!s) return false;
  return BUSINESS_WORDS.some((w) => s.includes(w));
}

/** Código de unidade do imóvel embutido no nome ("Ana Beatriz 206"). */
export function extractUnitCode(raw: string | null | undefined): string | null {
  const m = (raw ?? "").match(/\b(B0\d{2}|[124]\d{2})\b/i);
  return m ? m[1].toUpperCase() : null;
}

/** Marcadores presentes no texto — viram sugestão de tag. */
export function extractMarkers(raw: string | null | undefined): string[] {
  const s = (raw ?? "").toLowerCase();
  return RELATIONSHIP_MARKERS.filter((m) => new RegExp(`\\b${m}\\b`, "i").test(s));
}

/** Só dígitos/símbolos? Então não é nome. */
export function looksLikePhone(s: string): boolean {
  return /^[0-9+()\-\s.]+$/.test(s.trim());
}

/**
 * Nome "sujo" — precisa de revisão antes de virar {{primeiro_nome}}.
 * Handle de rede social, telefone, emoji, caixa toda igual, marcador de
 * origem, número solto ou nome de uma letra só.
 */
export function nameNeedsReview(raw: string | null | undefined): boolean {
  const s = (raw ?? "").trim();
  if (!s) return true;
  if (looksLikePhone(s)) return true;
  if (/[@_.]/.test(s)) return true;                      // handles: @fulano, joao.silva, maria_ig
  if (EMOJI.test(s)) return true;
  if (/\d/.test(s)) return true;                          // "Cliente 3", "Joao 2"
  if (s.length <= 2) return true;
  if (s === s.toUpperCase() && s.length > 3) return true; // GRITANDO
  if (s === s.toLowerCase() && /[a-z]/.test(s)) return true; // tudo minúsculo
  const words = s.toLowerCase().split(/\s+/);
  if (words.some((w) => SOURCE_WORDS.includes(w))) return true;
  return false;
}

/** Title Case respeitando partículas ("de", "da", "dos"). */
export function titleCase(s: string): string {
  const small = new Set(["de", "da", "do", "das", "dos", "e", "di", "du", "van", "von"]);
  return s
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((w, i) => (i > 0 && small.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(" ");
}

/**
 * Limpeza determinística (sem IA): remove emoji, handle, marcadores de origem
 * e arruma a caixa. Devolve `null` quando não sobra nome utilizável.
 */
export function cleanName(raw: string | null | undefined): string | null {
  let s = (raw ?? "").replace(EMOJI, " ").trim();
  if (!s || looksLikePhone(s)) return null;
  s = s.replace(/\((.*?)\)/g, " ");                 // "(Airbnb)"
  s = s.replace(/[@]/g, " ").replace(/[._]+/g, " "); // handle → palavras
  s = s.replace(/\s+/g, " ").trim();
  const words = s
    .split(" ")
    .filter((w) => w && !SOURCE_WORDS.includes(w.toLowerCase()) && !/^\d+$/.test(w));
  if (words.length === 0) return null;
  const cleaned = titleCase(words.join(" ")).trim();
  return cleaned.length >= 2 ? cleaned : null;
}

export interface NameParts {
  first_name: string | null;
  last_name: string | null;
  display_name: string | null;
}

/** Quebra um nome já limpo em primeiro/sobrenome. */
export function splitName(full: string | null): NameParts {
  if (!full) return { first_name: null, last_name: null, display_name: null };
  const parts = full.split(/\s+/).filter(Boolean);
  return {
    first_name: parts[0] ?? null,
    last_name: parts.length > 1 ? parts.slice(1).join(" ") : null,
    display_name: full,
  };
}

/**
 * Nome a usar em {{primeiro_nome}} — preferência: nome social → primeiro nome
 * → primeira palavra do display_name limpo. `null` quando nada serve (o
 * chamador decide o fallback, ex.: saudação sem nome).
 */
export function preferredFirstName(c: {
  social_name?: string | null;
  first_name?: string | null;
  display_name?: string | null;
}): string | null {
  if (c.social_name?.trim()) return c.social_name.trim().split(/\s+/)[0];
  if (c.first_name?.trim()) return c.first_name.trim().split(/\s+/)[0];
  const cleaned = cleanName(c.display_name);
  return cleaned ? cleaned.split(/\s+/)[0] : null;
}

/** Nome completo preferido para {{nome}}. */
export function preferredFullName(c: {
  social_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  display_name?: string | null;
}): string | null {
  if (c.social_name?.trim()) return c.social_name.trim();
  if (c.first_name?.trim()) {
    return [c.first_name.trim(), c.last_name?.trim()].filter(Boolean).join(" ");
  }
  return cleanName(c.display_name);
}
