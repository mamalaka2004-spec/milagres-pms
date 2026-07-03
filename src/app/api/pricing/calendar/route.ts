import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { apiSuccess, apiError, apiUnauthorized, apiNotFound, apiServerError } from "@/lib/api/response";
import { getQuote } from "@/lib/db/queries/pricing";
import { calendarQuerySchema } from "@/lib/validations/pricing";

// GET /api/pricing/calendar?property_id=&month=YYYY-MM
// Simulador: preço resolvido de cada dia do mês (reusa o quote no intervalo do mês).
export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth();
    const parsed = calendarQuerySchema.safeParse({
      property_id: req.nextUrl.searchParams.get("property_id"),
      month: req.nextUrl.searchParams.get("month"),
    });
    if (!parsed.success) return apiError("Parâmetros inválidos", 400, parsed.error.flatten());

    const [year, month] = parsed.data.month.split("-").map(Number);
    const start = `${parsed.data.month}-01`;
    const next = month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, "0")}-01`;

    const quote = await getQuote(user.company_id, parsed.data.property_id, start, next);
    if (!quote) return apiNotFound("Imóvel");
    return apiSuccess({
      property_id: quote.property_id,
      month: parsed.data.month,
      base_price_cents: quote.base_price_cents,
      days: quote.nights,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    return apiServerError(error);
  }
}
