import { apiError } from "@/lib/api/response";

/**
 * APOSENTADA. O polling do n8n para campanhas agendadas foi substituído pelo
 * worker `campaign-tick` (Supabase Edge Function + pg_cron), que processa
 * campanhas `scheduled` direto da fila — ver docs/campaign-engine.md.
 * Mantida só para responder 410 a crons antigos.
 */
export async function GET() {
  return apiError("Rota aposentada — o disparo agora é feito pelo worker campaign-tick (pg_cron).", 410);
}
