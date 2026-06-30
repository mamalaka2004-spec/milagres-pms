import { NextRequest } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { logActivity } from "@/lib/audit/log";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  apiSuccess,
  apiError,
  apiUnauthorized,
  apiForbidden,
  apiNotFound,
  apiServerError,
} from "@/lib/api/response";
import type { Database } from "@/types/database";

type UserRow = Database["public"]["Tables"]["users"]["Row"];

const patchSchema = z.object({
  full_name: z.string().min(2).max(80).optional(),
  phone: z.string().max(30).nullable().optional(),
  role: z.enum(["admin", "manager", "staff"]).optional(),
  is_active: z.boolean().optional(),
  password: z.string().min(8).max(72).optional(),
});

const LIST_SELECT = "id, full_name, email, role, phone, is_active, last_login_at, created_at";

interface Params {
  params: Promise<{ id: string }>;
}

/** Update a user (admin only): profile, role, active status, or reset password. */
export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const admin = await requireRole(["admin"]);
    const { id } = await params;
    const body = await request.json();
    const v = patchSchema.safeParse(body);
    if (!v.success) return apiError("Validação falhou", 400, v.error.flatten());
    const data = v.data;

    const supabase = createAdminClient();
    const { data: targetRaw } = await supabase
      .from("users")
      .select("id, company_id, role, is_active")
      .eq("id", id)
      .maybeSingle();
    const target = targetRaw as Pick<UserRow, "id" | "company_id" | "role" | "is_active"> | null;
    if (!target || target.company_id !== admin.company_id) return apiNotFound("Usuário");

    const isSelf = target.id === admin.id;

    // Self-protection: an admin can't demote or deactivate themselves (avoids lock-out).
    if (isSelf && data.role && data.role !== "admin") {
      return apiError("Você não pode rebaixar a própria conta.", 400);
    }
    if (isSelf && data.is_active === false) {
      return apiError("Você não pode desativar a própria conta.", 400);
    }

    // Don't strand the company without an admin.
    if ((data.role && data.role !== "admin" && target.role === "admin") || (data.is_active === false && target.role === "admin")) {
      const { count } = await supabase
        .from("users")
        .select("id", { count: "exact", head: true })
        .eq("company_id", admin.company_id)
        .eq("role", "admin")
        .eq("is_active", true);
      if ((count || 0) <= 1) return apiError("É preciso manter pelo menos um admin ativo.", 400);
    }

    // Password reset goes through the auth admin API.
    if (data.password) {
      const { error: pErr } = await supabase.auth.admin.updateUserById(id, { password: data.password });
      if (pErr) return apiError(`Falha ao redefinir senha: ${pErr.message}`, 400);
    }

    const profilePatch: Record<string, unknown> = {};
    if (data.full_name !== undefined) profilePatch.full_name = data.full_name;
    if (data.phone !== undefined) profilePatch.phone = data.phone;
    if (data.role !== undefined) profilePatch.role = data.role;
    if (data.is_active !== undefined) profilePatch.is_active = data.is_active;

    if (Object.keys(profilePatch).length === 0) {
      const { data: row } = await supabase.from("users").select(LIST_SELECT).eq("id", id).single();
      if (data.password) {
        await logActivity({ user: admin, action: "user.update", entityType: "user", entityId: id, details: { label: (row as { full_name?: string } | null)?.full_name ?? null, password_reset: true } });
      }
      return apiSuccess(row);
    }

    profilePatch.updated_at = new Date().toISOString();
    const { data: row, error } = await (supabase.from("users") as any) // eslint-disable-line @typescript-eslint/no-explicit-any
      .update(profilePatch)
      .eq("id", id)
      .select(LIST_SELECT)
      .single();
    if (error) throw error;
    await logActivity({ user: admin, action: "user.update", entityType: "user", entityId: id, details: { label: (row as { full_name?: string } | null)?.full_name ?? null } });
    return apiSuccess(row);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    if (error instanceof Error && error.message === "Forbidden") return apiForbidden();
    return apiServerError(error);
  }
}
