import { createServerClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type User = Database["public"]["Tables"]["users"]["Row"];

export async function getAuthUser(): Promise<User | null> {
  const supabase = await createServerClient();

  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) return null;

  const { data: user, error } = await supabase
    .from("users")
    .select("*")
    .eq("id", authUser.id)
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
