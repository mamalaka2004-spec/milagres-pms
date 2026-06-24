import { NextRequest } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  apiSuccess,
  apiError,
  apiUnauthorized,
  apiForbidden,
  apiServerError,
} from "@/lib/api/response";
import type { Database } from "@/types/database";

type UserRow = Database["public"]["Tables"]["users"]["Row"];

const createSchema = z.object({
  email: z.string().email().max(160),
  full_name: z.string().min(2).max(80),
  role: z.enum(["admin", "manager", "staff"]),
  phone: z.string().max(30).optional().nullable(),
  password: z.string().min(8).max(72),
});

const LIST_SELECT = "id, full_name, email, role, phone, is_active, last_login_at, created_at";

/** List the company's users (admin + manager can view). */
export async function GET() {
  try {
    const user = await requireRole(["admin", "manager"]);
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("users")
      .select(LIST_SELECT)
      .eq("company_id", user.company_id)
      .order("full_name");
    if (error) throw error;
    return apiSuccess((data as Partial<UserRow>[]) || []);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    if (error instanceof Error && error.message === "Forbidden") return apiForbidden();
    return apiServerError(error);
  }
}

/** Create a user (admin only). Creates the Supabase auth user + the public.users row. */
export async function POST(request: NextRequest) {
  try {
    const admin = await requireRole(["admin"]);
    const body = await request.json();
    const v = createSchema.safeParse(body);
    if (!v.success) return apiError("Validação falhou", 400, v.error.flatten());
    const { email, full_name, role, phone, password } = v.data;

    const supabase = createAdminClient();

    // 1. Create the auth user (email pre-confirmed — no SMTP dependency).
    const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name },
    });
    if (authErr || !authData.user) {
      const msg = authErr?.message || "";
      if (/registered|already/i.test(msg)) return apiError("Já existe um usuário com este e-mail.", 409);
      return apiError(`Falha ao criar acesso: ${msg}`, 400);
    }
    const id = authData.user.id;

    // 2. Create the matching profile row in our company.
    const { data: row, error: insErr } = await (supabase.from("users") as any) // eslint-disable-line @typescript-eslint/no-explicit-any
      .insert({
        id,
        company_id: admin.company_id,
        email,
        full_name,
        role,
        phone: phone || null,
        is_active: true,
        language: "pt-BR",
      })
      .select(LIST_SELECT)
      .single();

    if (insErr) {
      // Roll back the orphan auth user so the email can be reused.
      await supabase.auth.admin.deleteUser(id).catch(() => null);
      if ((insErr as { code?: string }).code === "23505") return apiError("Já existe um usuário com este e-mail.", 409);
      return apiError(`Falha ao criar perfil: ${insErr.message}`, 500);
    }

    return apiSuccess(row, 201);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    if (error instanceof Error && error.message === "Forbidden") return apiForbidden();
    return apiServerError(error);
  }
}
