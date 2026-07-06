// ===========================================================================
// Stripe — camada de billing para COMPRA DE CRÉDITOS DE IA (#27)
// ---------------------------------------------------------------------------
// ESCOPO: Stripe é usado SOMENTE para recarregar créditos de IA (migration 030).
// As cobranças de RESERVAS de hóspedes usam Asaas (migration 017) e NÃO passam
// por aqui.
//
// ENV-GATED: as chaves Stripe (STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET) ainda
// não existem (o usuário vai criar a conta). Enquanto ausentes,
// `isStripeConfigured()` é false e as rotas devolvem 501 em runtime — o build e
// o tsc compilam normalmente. NUNCA hardcode segredo aqui.
// ===========================================================================
import Stripe from "stripe";

let _stripe: Stripe | null = null;

/**
 * true SOMENTE se ambas as chaves Stripe estiverem presentes. O fluxo completo
 * (checkout + webhook) exige as duas, então tratamos "configurado" como binário.
 */
export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET);
}

/**
 * Instância singleton do SDK Stripe. Lança se STRIPE_SECRET_KEY estiver ausente —
 * as rotas devem checar `isStripeConfigured()` antes e devolver 501, de modo que
 * isto nunca lança em runtime normal.
 *
 * apiVersion é omitida de propósito: o SDK usa a versão fixada na sua própria
 * build, evitando quebrar o tsc quando o SDK for atualizado.
 */
export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY não configurada");
  }
  if (!_stripe) {
    _stripe = new Stripe(key, {
      appInfo: { name: "Milagres PMS — AI Credits" },
    });
  }
  return _stripe;
}

// ─── Pacotes de crédito ──────────────────────────────────────────────────────
// Preço DINÂMICO via `price_data` no Checkout (BRL, centavos) — NÃO exige Price
// IDs pré-criados no dashboard da Stripe. `credits` é quanto o comprador recebe
// (via topUpAiCredits no webhook). `priceCents` é o valor cobrado, em centavos
// de BRL (ex.: 4900 = R$ 49,00).

export interface CreditPackage {
  /** Identificador estável usado no body do checkout e na metadata do pagamento. */
  id: string;
  /** Créditos de IA creditados na confirmação do pagamento. */
  credits: number;
  /** Preço em CENTAVOS de BRL cobrado pelo pacote. */
  priceCents: number;
  /** Rótulo curto para UI / descrição da linha no Checkout. */
  label: string;
  /** Descrição opcional exibida no Checkout. */
  description?: string;
}

/**
 * Pacotes confirmados pelo usuário. Preços iguais aos originais; só a quantidade
 * de créditos foi reduzida 10× (percepção do usuário). Com TOKENS_PER_CREDIT =
 * 10.000, o poder de compra em tokens e o preço são idênticos ao esquema anterior
 * (1000/5000/20000 créditos): 100 cr = 1M tokens = R$ 49,00, etc.
 */
export const CREDIT_PACKAGES: CreditPackage[] = [
  {
    id: "credits_100",
    credits: 100,
    priceCents: 4_900, // R$ 49,00 — ~1.000.000 tokens
    label: "100 créditos",
    description: "Pacote inicial de créditos de IA (~1 milhão de tokens)",
  },
  {
    id: "credits_500",
    credits: 500,
    priceCents: 19_900, // R$ 199,00 — ~5.000.000 tokens
    label: "500 créditos",
    description: "Pacote intermediário de créditos de IA (~5 milhões de tokens)",
  },
  {
    id: "credits_2k",
    credits: 2_000,
    priceCents: 69_900, // R$ 699,00 — ~20.000.000 tokens
    label: "2.000 créditos",
    description: "Pacote avançado de créditos de IA (~20 milhões de tokens)",
  },
];

/** Busca um pacote pelo id (undefined se não existir). */
export function getCreditPackage(id: string): CreditPackage | undefined {
  return CREDIT_PACKAGES.find((p) => p.id === id);
}
