import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe, isStripeConfigured } from "@/lib/billing/stripe";
import { topUpAiCredits } from "@/lib/ai/credits";
import { logActivity } from "@/lib/audit/log";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * Webhook da Stripe — COMPRA de créditos de IA (#27).
 *
 * Configure no dashboard da Stripe:
 *   Endpoint URL: https://<app>/api/webhooks/stripe
 *   Evento:       checkout.session.completed
 *   O "Signing secret" gerado vai em STRIPE_WEBHOOK_SECRET.
 *
 * Segurança: lê o corpo BRUTO e verifica a assinatura (constructEvent). Só isso
 * autentica a origem — NÃO confie em nada antes da verificação.
 *
 * Idempotência: topUpAiCredits(stripeSessionId) pula se a sessão já foi creditada
 * (índice único parcial em ai_credit_ledger.stripe_session_id — migration 032),
 * então retries da Stripe nunca creditam 2×.
 *
 * Só para créditos de IA. Cobranças de RESERVAS usam o webhook do Asaas.
 */
export async function POST(request: NextRequest) {
  // Env-gated: sem chaves configuradas, não há o que verificar.
  if (!isStripeConfigured()) {
    return NextResponse.json(
      { success: false, error: "Stripe não configurado" },
      { status: 501 }
    );
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json(
      { success: false, error: "Assinatura ausente" },
      { status: 400 }
    );
  }

  // Corpo BRUTO é obrigatório para verificar a assinatura.
  const rawBody = await request.text();

  let event: Stripe.Event;
  try {
    const stripe = getStripe();
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    console.error("[stripe] falha ao verificar assinatura:", err);
    return NextResponse.json(
      { success: false, error: "Assinatura inválida" },
      { status: 400 }
    );
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;

      // Só credita quando o pagamento realmente foi concluído.
      if (session.payment_status !== "paid") {
        return NextResponse.json({ received: true, credited: false });
      }

      const companyId = session.metadata?.company_id;
      const credits = Number(session.metadata?.credits);
      const packageId = session.metadata?.package_id ?? null;
      const purchasedBy = session.metadata?.purchased_by ?? null;

      if (!companyId || !Number.isInteger(credits) || credits <= 0) {
        // Sessão sem metadata utilizável — não é nosso fluxo; ACK para não gerar retry.
        console.error("[stripe] checkout.session.completed sem metadata válida:", session.id);
        return NextResponse.json({ received: true, credited: false });
      }

      const entry = await topUpAiCredits({
        companyId,
        credits,
        createdBy: purchasedBy,
        source: "gateway",
        // reference_id no ledger é UUID; IDs da Stripe (não-UUID) vão na metadata.
        description: `Compra de ${credits} créditos de IA (Stripe)`,
        stripeSessionId: session.id,
        metadata: {
          stripe_session_id: session.id,
          stripe_payment_intent:
            typeof session.payment_intent === "string"
              ? session.payment_intent
              : session.payment_intent?.id ?? null,
          package_id: packageId,
          amount_total: session.amount_total,
          currency: session.currency,
        },
      });

      // Audit (fire-and-forget). Usa o comprador como ator quando disponível.
      if (purchasedBy) {
        await logActivity({
          user: { id: purchasedBy, company_id: companyId },
          action: "ai_settings.update",
          entityType: "ai_settings",
          entityId: companyId,
          details: {
            stripe_checkout_paid: true,
            package_id: packageId,
            credits,
            session_id: session.id,
            balance_after: entry.balance_after,
          },
        });
      }

      return NextResponse.json({ received: true, credited: true });
    }

    // Outros eventos: ACK sem ação.
    return NextResponse.json({ received: true });
  } catch (err) {
    // Erro ao processar (ex.: DB indisponível): 500 faz a Stripe reenviar, e a
    // idempotência por stripe_session_id garante que não credita 2×.
    console.error("[stripe] erro ao processar evento:", err);
    return NextResponse.json(
      { success: false, error: "Erro ao processar evento" },
      { status: 500 }
    );
  }
}
