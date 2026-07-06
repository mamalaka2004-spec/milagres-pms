import { NextRequest } from "next/server";
import { requireFullAccess } from "@/lib/auth";
import { apiSuccess, apiError, apiUnauthorized, apiForbidden, apiNotFound, apiServerError } from "@/lib/api/response";
import { getQuote } from "@/lib/db/queries/pricing";
import { quoteQuerySchema } from "@/lib/validations/pricing";

// GET /api/pricing/quote?property_id=&check_in=&check_out=
// Usado pelo formulário de reserva para pré-preencher o valor base.
export async function GET(req: NextRequest) {
  try {
    const user = await requireFullAccess();
    const parsed = quoteQuerySchema.safeParse({
      property_id: req.nextUrl.searchParams.get("property_id"),
      check_in: req.nextUrl.searchParams.get("check_in"),
      check_out: req.nextUrl.searchParams.get("check_out"),
    });
    if (!parsed.success) return apiError("Parâmetros inválidos", 400, parsed.error.flatten());
    const quote = await getQuote(
      user.company_id,
      parsed.data.property_id,
      parsed.data.check_in,
      parsed.data.check_out
    );
    if (!quote) return apiNotFound("Imóvel");
    return apiSuccess(quote);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    if (error instanceof Error && error.message === "Forbidden") return apiForbidden();
    return apiServerError(error);
  }
}
