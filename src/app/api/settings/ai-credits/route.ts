import { requireAuth } from "@/lib/auth";
import { getCreditOverview } from "@/lib/ai/credits";
import {
  apiSuccess,
  apiUnauthorized,
  apiServerError,
} from "@/lib/api/response";

/**
 * Ajustes → Créditos de IA (#27). Saldo + resumo do mês + extrato.
 * PROVIDER-AGNOSTIC: nenhum gateway de pagamento envolvido.
 */
export async function GET() {
  try {
    const user = await requireAuth();
    const overview = await getCreditOverview(user.company_id);
    return apiSuccess(overview);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    return apiServerError(error);
  }
}
