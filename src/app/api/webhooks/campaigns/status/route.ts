import { apiError } from "@/lib/api/response";

/**
 * APOSENTADA. O callback por destinatário do n8n foi substituído pelo worker
 * `campaign-tick`, que grava o resultado direto no banco — ver
 * docs/campaign-engine.md. Eventos delivered/read passam a chegar por
 * /api/webhooks/whatsapp/status (Etapa 3).
 */
export async function POST() {
  return apiError("Rota aposentada — o disparo agora é feito pelo worker campaign-tick (pg_cron).", 410);
}
