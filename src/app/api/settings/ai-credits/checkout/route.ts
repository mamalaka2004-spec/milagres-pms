import { NextRequest } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { logActivity } from "@/lib/audit/log";
import { getStripe, isStripeConfigured, getCreditPackage } from "@/lib/billing/stripe";
import {
  apiError,
  apiSuccess,
  apiUnauthorized,
  apiForbidden,
  apiServerError,
} from "@/lib/api/response";

export const runtime = "nodejs";

const bodySchema = z.object({
  package_id: z.string().min(1).max(64),
});

/**
 * COMPRA de créditos de IA (#27) — cria uma Stripe Checkout Session.
 *
 * Auth: admin (mesma regra do top-up manual). Preço DINÂMICO via price_data
 * (BRL, centavos) — não exige Price IDs pré-criados no dashboard.
 *
 * Fluxo: o cliente chama esta rota → recebe { url } → redireciona o navegador
 * para a `url` do Checkout. Ao pagar, o webhook /api/webhooks/stripe credita os
 * créditos (idempotente). Ver src/lib/billing/stripe.ts (CREDIT_PACKAGES).
 *
 * Se as chaves Stripe não estiverem configuradas → 501 (Not Implemented).
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireRole(["admin"]);

    if (!isStripeConfigured()) {
      return apiError("Pagamento com Stripe não está configurado", 501);
    }

    const body = await request.json();
    const validation = bodySchema.safeParse(body);
    if (!validation.success) {
      return apiError("Validation failed", 400, validation.error.flatten());
    }

    const pkg = getCreditPackage(validation.data.package_id);
    if (!pkg) {
      return apiError("Pacote de créditos inválido", 400);
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    if (!appUrl) {
      return apiServerError(new Error("NEXT_PUBLIC_APP_URL não configurada"));
    }
    const base = appUrl.replace(/\/$/, "");

    const stripe = getStripe();
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      // Preço dinâmico em BRL — sem Price ID pré-criado.
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "brl",
            unit_amount: pkg.priceCents,
            product_data: {
              name: `${pkg.label} — créditos de IA`,
              ...(pkg.description ? { description: pkg.description } : {}),
            },
          },
        },
      ],
      // O webhook lê estes campos para creditar a empresa certa.
      metadata: {
        company_id: user.company_id,
        credits: String(pkg.credits),
        package_id: pkg.id,
        purchased_by: user.id,
      },
      success_url: `${base}/settings/ai-credits?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/settings/ai-credits?checkout=cancel`,
    });

    await logActivity({
      user,
      action: "ai_settings.update",
      entityType: "ai_settings",
      entityId: user.company_id,
      details: {
        stripe_checkout_created: true,
        package_id: pkg.id,
        credits: pkg.credits,
        amount_cents: pkg.priceCents,
        session_id: session.id,
      },
    });

    return apiSuccess({ url: session.url, session_id: session.id });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    if (error instanceof Error && error.message === "Forbidden") return apiForbidden();
    return apiServerError(error);
  }
}
