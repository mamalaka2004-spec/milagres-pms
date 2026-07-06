import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import type { Database, UserRole } from "@/types/database";

type User = Database["public"]["Tables"]["users"]["Row"];

export async function getAuthUser(): Promise<User | null> {
  const supabase = await createServerClient();

  // getClaims() verifies the JWT signature locally (no network round-trip) when the
  // project uses asymmetric signing keys, cutting ~1 latency hop per page navigation.
  // The middleware already does the authoritative getUser() refresh on each request.
  let userId: string | undefined;
  try {
    const { data } = await supabase.auth.getClaims();
    userId = data?.claims?.sub as string | undefined;
  } catch {
    userId = undefined;
  }

  // Fallback: full network validation if claims are unavailable.
  if (!userId) {
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();
    if (!authUser) return null;
    userId = authUser.id;
  }

  const { data: user, error } = await supabase
    .from("users")
    .select("*")
    .eq("id", userId)
    .single();

  if (error || !user) return null;
  return user as User;
}

export async function requireAuth(): Promise<User> {
  const user = await getAuthUser();
  if (!user) {
    throw new Error("Unauthorized");
  }
  return user;
}

export async function requireRole(roles: UserRole[]): Promise<User> {
  const user = await requireAuth();
  if (!roles.includes(user.role)) {
    throw new Error("Forbidden");
  }
  return user;
}

/**
 * Auth para rotas de DADOS SENSÍVEIS (valores, financeiro, hóspedes, chat).
 * Qualquer papel exceto camareira — que só enxerga Agenda + Operações, sem preços (#13).
 */
export async function requireFullAccess(): Promise<User> {
  const user = await requireAuth();
  if (user.role === "camareira") throw new Error("Forbidden");
  return user;
}

/**
 * Guard de PÁGINA: camareira é redirecionada para a home dela (/operations)
 * em vez de ver telas com valores. Use nas páginas server-side sensíveis.
 */
export async function requirePageAuth(opts?: { camareira?: boolean }): Promise<User> {
  const user = await requireAuth();
  if (user.role === "camareira" && !opts?.camareira) redirect("/operations");
  return user;
}
