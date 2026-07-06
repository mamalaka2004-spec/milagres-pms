import { NextRequest } from "next/server";
import { apiSuccess, apiError, apiServerError } from "@/lib/api/response";
import {
  runAutomationSweep,
  runRetentionForCompany,
  listCompanyIds,
  type RetentionResult,
} from "@/lib/db/queries/ops-jobs";

export const maxDuration = 60;

/**
 * Job diário de Operações — chamado pelo cron do n8n (mesmo padrão de /api/campaigns/due):
 *   GET /api/operations/jobs/run  (header x-webhook-secret = WHATSAPP_WEBHOOK_SECRET)
 *
 * 1. Varredura de automação: garante tarefas de limpeza/preparo para reservas dos
 *    próximos 7 dias (rede de segurança dos hooks de criação/transição).
 * 2. Retenção de storage (#14): remove mídia de tarefas concluídas há mais de N dias
 *    (config por empresa em Ajustes → Operações; default 90 dias).
 */
export async function GET(request: NextRequest) {
  const expected = process.env.WHATSAPP_WEBHOOK_SECRET;
  const provided = request.headers.get("x-webhook-secret") || "";
  if (!expected || provided !== expected) return apiError("Unauthorized", 401);

  try {
    const automation = await runAutomationSweep(7);

    const retention: RetentionResult[] = [];
    for (const companyId of await listCompanyIds()) {
      try {
        retention.push(await runRetentionForCompany(companyId));
      } catch (err) {
        console.error(`Retention failed for company ${companyId}:`, err);
      }
    }

    return apiSuccess({ automation, retention });
  } catch (error) {
    return apiServerError(error);
  }
}
