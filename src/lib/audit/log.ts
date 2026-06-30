import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Audit log (#16). `logActivity` records a management action in `activity_logs`.
 *
 * Design notes:
 * - Fire-and-forget semantics: it NEVER throws. A failed audit write must not
 *   break the user's actual mutation, so all errors are swallowed + logged.
 * - Uses the service-role admin client so the insert bypasses RLS regardless of
 *   the caller's session.
 * - Wire it AFTER a mutation succeeds, passing the authenticated user (for
 *   company scoping + actor attribution).
 */

export type AuditActor = { id: string; company_id: string };

export interface LogActivityInput {
  /** The authenticated user performing the action (from requireAuth/requireRole). */
  user: AuditActor;
  /** Dotted action code, e.g. "reservation.create", "guest.delete". */
  action: string;
  /** Entity family, e.g. "reservation", "guest", "property". */
  entityType?: string;
  /** Affected row id (UUID), when applicable. */
  entityId?: string | null;
  /** Small JSON snapshot for the timeline (names, status changes, amounts…). */
  details?: Record<string, unknown> | null;
}

function clientIp(): Promise<string | null> {
  // headers() is only available inside a request scope; guard against misuse.
  return (async () => {
    try {
      const h = await headers();
      const fwd = h.get("x-forwarded-for");
      const ip = (fwd ? fwd.split(",")[0] : h.get("x-real-ip") || "").trim();
      return ip || null;
    } catch {
      return null;
    }
  })();
}

export async function logActivity(input: LogActivityInput): Promise<void> {
  try {
    const supabase = createAdminClient();
    const ip = await clientIp();
    const { error } = await (supabase.from("activity_logs") as any).insert({ // eslint-disable-line @typescript-eslint/no-explicit-any
      company_id: input.user.company_id,
      user_id: input.user.id,
      action: input.action,
      entity_type: input.entityType ?? null,
      entity_id: input.entityId ?? null,
      details: input.details ?? null,
      ip_address: ip,
    });
    if (error) throw error;
  } catch (err) {
    // Audit must never break the request it observes.
    console.error("[audit] logActivity failed:", err);
  }
}
