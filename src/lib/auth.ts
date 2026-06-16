import { createServerClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

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

export async function requireRole(roles: Array<"admin" | "manager" | "staff">): Promise<User> {
  const user = await requireAuth();
  if (!roles.includes(user.role)) {
    throw new Error("Forbidden");
  }
  return user;
}
