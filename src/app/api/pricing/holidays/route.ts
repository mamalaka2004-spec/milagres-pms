import { NextRequest } from "next/server";
import { requireAuth, requireRole } from "@/lib/auth";
import { logActivity } from "@/lib/audit/log";
import { apiSuccess, apiError, apiUnauthorized, apiForbidden, apiServerError } from "@/lib/api/response";
import { listHolidays, createHoliday } from "@/lib/db/queries/pricing";
import { holidaySchema } from "@/lib/validations/pricing";

export async function GET() {
  try {
    const user = await requireAuth();
    const data = await listHolidays(user.company_id);
    return apiSuccess(data);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    // Tabela ainda não existe (migration 026 não rodada) — degrada.
    return apiSuccess([]);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireRole(["admin", "manager"]);
    const parsed = holidaySchema.safeParse(await req.json());
    if (!parsed.success) return apiError("Dados inválidos", 400, parsed.error.flatten());
    const holiday = await createHoliday(user.company_id, parsed.data);
    await logActivity({ user, action: "holiday.create", entityType: "holiday", entityId: holiday.id, details: { label: holiday.name, date: holiday.date } });
    return apiSuccess(holiday, 201);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    if (error instanceof Error && error.message === "Forbidden") return apiForbidden();
    return apiServerError(error);
  }
}
