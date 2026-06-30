import { NextRequest } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { apiSuccess, apiError, apiUnauthorized, apiServerError } from "@/lib/api/response";
import type { Json } from "@/types/database";

// Per-user UI preferences. Currently only the Locação×Vendas mode, but kept
// open so future client prefs can merge into the same blob.
const prefsSchema = z.object({
  mode: z.enum(["locacao", "vendas"]).optional(),
});

/** Returns the current user's preferences blob. */
export async function GET() {
  try {
    const user = await requireAuth();
    return apiSuccess({ preferences: (user.preferences as Json) ?? {} });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    return apiServerError(error);
  }
}

/** Shallow-merges the posted keys into the current user's preferences. */
export async function PATCH(request: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await request.json();
    const v = prefsSchema.safeParse(body);
    if (!v.success) return apiError("Validação falhou", 400, v.error.flatten());

    const current =
      user.preferences && typeof user.preferences === "object" && !Array.isArray(user.preferences)
        ? (user.preferences as Record<string, unknown>)
        : {};
    const merged = { ...current, ...v.data };

    const supabase = createAdminClient();
    const { error } = await (supabase.from("users") as any) // eslint-disable-line @typescript-eslint/no-explicit-any
      .update({ preferences: merged as Json, updated_at: new Date().toISOString() })
      .eq("id", user.id);
    if (error) throw error;

    return apiSuccess({ preferences: merged });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    return apiServerError(error);
  }
}
