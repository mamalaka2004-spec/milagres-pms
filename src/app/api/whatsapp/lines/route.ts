import { NextRequest } from "next/server";
import { requireAuth, requireRole } from "@/lib/auth";
import { listLinesForUser } from "@/lib/db/queries/whatsapp";
import { createAdminClient } from "@/lib/supabase/admin";
import { lineCreateSchema } from "@/lib/validations/whatsapp";
import {
  apiSuccess,
  apiError,
  apiUnauthorized,
  apiForbidden,
  apiServerError,
} from "@/lib/api/response";

export async function GET() {
  try {
    const user = await requireAuth();
    const lines = await listLinesForUser(user.id, user.company_id);
    return apiSuccess(lines);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    return apiServerError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireRole(["admin", "manager"]);
    const body = await request.json();
    const validation = lineCreateSchema.safeParse(body);
    if (!validation.success) {
      return apiError("Validation failed", 400, validation.error.flatten());
    }
    const data = validation.data;
    const phone = data.phone.startsWith("+") ? data.phone : `+${data.phone}`;

    const supabase = createAdminClient();
    const { data: created, error } = await (supabase.from("whatsapp_lines") as any) // eslint-disable-line @typescript-eslint/no-explicit-any
      .insert({
        company_id: user.company_id,
        phone,
        label: data.label,
        purpose: data.purpose,
        provider: data.provider,
        provider_instance: data.provider_instance ?? null,
        business_hours: data.business_hours ?? null,
        ai_enabled: data.ai_enabled,
        is_active: true,
      })
      .select()
      .single();
    if (error) {
      if (error.code === "23505") return apiError("Phone already registered for this company", 409);
      throw error;
    }

    // Grant the creator access by default so they can immediately see/use the line.
    await (supabase.from("whatsapp_line_users") as any) // eslint-disable-line @typescript-eslint/no-explicit-any
      .insert({ line_id: (created as { id: string }).id, user_id: user.id, can_send: true })
      .then(() => null, () => null); // ignore unique-violation if duplicate

    return apiSuccess(created, 201);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    if (error instanceof Error && error.message === "Forbidden") return apiForbidden();
    return apiServerError(error);
  }
}
