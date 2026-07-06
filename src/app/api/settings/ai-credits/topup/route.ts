import { NextRequest } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { logActivity } from "@/lib/audit/log";
import { topUpAiCredits, getCreditOverview } from "@/lib/ai/credits";
import {
  apiSuccess,
  apiError,
  apiUnauthorized,
  apiForbidden,
  apiServerError,
} from "@/lib/api/response";

const bodySchema = z.object({
  credits: z.number().int().positive().max(1_000_000),
  description: z.string().max(200).optional(),
});

/**
 * Top-up manual interno (#27). Ação ADMINISTRATIVA apenas para deixar o ledger
 * testável agora — NÃO é uma compra real.
 *
 * TODO(billing): a cobrança automática (Stripe / Asaas / interno — DECISÃO
 * PENDENTE do usuário) entra aqui. Quando o gateway existir, o crédito passa a
 * vir de um webhook de pagamento confirmado chamando `topUpAiCredits` com
 * source='gateway'; esta rota manual pode virar admin-only de suporte.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireRole(["admin"]);
    const body = await request.json();
    const validation = bodySchema.safeParse(body);
    if (!validation.success) {
      return apiError("Validation failed", 400, validation.error.flatten());
    }
    const { credits, description } = validation.data;

    const entry = await topUpAiCredits({
      companyId: user.company_id,
      credits,
      createdBy: user.id,
      description: description || "Recarga manual (admin)",
      source: "manual_topup",
    });

    await logActivity({
      user,
      action: "ai_settings.update",
      entityType: "ai_settings",
      entityId: user.company_id,
      details: { credits_topup: credits, balance_after: entry.balance_after },
    });

    const overview = await getCreditOverview(user.company_id);
    return apiSuccess(overview);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    if (error instanceof Error && error.message === "Forbidden") return apiForbidden();
    return apiServerError(error);
  }
}
