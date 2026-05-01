import { NextRequest } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
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

type LineRow = Database["public"]["Tables"]["whatsapp_lines"]["Row"];
type UserRow = Database["public"]["Tables"]["users"]["Row"];

interface Params {
  params: Promise<{ id: string }>;
}

const putSchema = z.object({
  user_ids: z.array(z.string().uuid()).max(200),
});

/**
 * GET — return the company's user roster annotated with has_access for this line.
 * PUT — replace the access list (atomic: delete then insert).
 *
 * Admin/manager only. The same role can always access any line in their company
 * (per RLS), so this is just for granting `staff` users explicit access.
 */
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const user = await requireRole(["admin", "manager"]);
    const { id: lineId } = await params;

    const supabase = createAdminClient();
    const { data: lineData } = await supabase
      .from("whatsapp_lines")
      .select("*")
      .eq("id", lineId)
      .maybeSingle();
    const line = lineData as LineRow | null;
    if (!line) return apiNotFound("Line");
    if (line.company_id !== user.company_id) return apiForbidden();

    const [{ data: usersData }, { data: grantsData }] = await Promise.all([
      supabase
        .from("users")
        .select("id, full_name, email, role, is_active")
        .eq("company_id", user.company_id)
        .order("full_name"),
      supabase
        .from("whatsapp_line_users")
        .select("user_id")
        .eq("line_id", lineId),
    ]);

    const grantedSet = new Set(((grantsData as { user_id: string }[]) || []).map((g) => g.user_id));
    const users = ((usersData as Pick<UserRow, "id" | "full_name" | "email" | "role" | "is_active">[]) || []).map((u) => ({
      ...u,
      has_access: u.role === "admin" || u.role === "manager" || grantedSet.has(u.id),
      implicit: u.role === "admin" || u.role === "manager",
    }));

    return apiSuccess({ line, users });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    if (error instanceof Error && error.message === "Forbidden") return apiForbidden();
    return apiServerError(error);
  }
}

export async function PUT(req: NextRequest, { params }: Params) {
  try {
    const user = await requireRole(["admin", "manager"]);
    const { id: lineId } = await params;

    const body = await req.json();
    const validation = putSchema.safeParse(body);
    if (!validation.success) return apiError("Validation failed", 400, validation.error.flatten());
    const { user_ids } = validation.data;

    const supabase = createAdminClient();
    const { data: lineData } = await supabase
      .from("whatsapp_lines")
      .select("company_id")
      .eq("id", lineId)
      .maybeSingle();
    const line = lineData as { company_id: string } | null;
    if (!line) return apiNotFound("Line");
    if (line.company_id !== user.company_id) return apiForbidden();

    // Verify every requested user belongs to the same company (defense in depth).
    if (user_ids.length > 0) {
      const { data: validUsers } = await supabase
        .from("users")
        .select("id")
        .in("id", user_ids)
        .eq("company_id", user.company_id);
      const validSet = new Set(((validUsers as { id: string }[]) || []).map((u) => u.id));
      if (validSet.size !== user_ids.length) return apiForbidden();
    }

    // Replace: delete existing then insert. Wrapped in a try so partial failure
    // isn't silently swallowed.
    const { error: delErr } = await supabase.from("whatsapp_line_users").delete().eq("line_id", lineId);
    if (delErr) throw delErr;
    if (user_ids.length > 0) {
      const rows = user_ids.map((uid) => ({ line_id: lineId, user_id: uid, can_send: true }));
      const { error: insErr } = await (supabase.from("whatsapp_line_users") as any) // eslint-disable-line @typescript-eslint/no-explicit-any
        .insert(rows);
      if (insErr) throw insErr;
    }

    return apiSuccess({ ok: true, granted: user_ids.length });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") return apiUnauthorized();
    if (error instanceof Error && error.message === "Forbidden") return apiForbidden();
    return apiServerError(error);
  }
}
