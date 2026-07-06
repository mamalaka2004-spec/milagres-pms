import { createAdminClient } from "@/lib/supabase/admin";
import { NOTIFIABLE_ROLES, type NotificationType } from "@/lib/notifications/types";

/**
 * Notificações in-app (#18). `createNotification` faz o fan-out de um evento para
 * os usuários relevantes da empresa.
 *
 * Design (espelha o audit log #16):
 * - Fire-and-forget: NUNCA lança. A notificação é secundária à mutação de origem
 *   (nova reserva, mensagem, cancelamento), então todo erro é engolido + logado.
 * - Usa o service-role (admin client): o insert ignora RLS e roda mesmo em rotas
 *   públicas (webhook, booking) sem sessão.
 * - Respeita `notification_preferences`: pula quem desligou aquele tipo.
 * - Destinatários = usuários da empresa com papel notificável (camareira fora),
 *   opcionalmente excluindo o autor da ação (`excludeUserId`).
 */

export interface CreateNotificationInput {
  companyId: string;
  type: NotificationType;
  title: string;
  body?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  /** Rota interna de destino ao clicar (ex.: "/reservations/<id>"). */
  link?: string | null;
  /** Não notificar quem disparou a ação (evita auto-notificação). */
  excludeUserId?: string | null;
}

export async function createNotification(input: CreateNotificationInput): Promise<void> {
  try {
    const supabase = createAdminClient();

    // Destinatários: papéis notificáveis da empresa.
    const { data: userRows, error: usersErr } = await supabase
      .from("users")
      .select("id")
      .eq("company_id", input.companyId)
      .in("role", NOTIFIABLE_ROLES as unknown as string[]);
    if (usersErr) throw usersErr;

    let recipients = (userRows as { id: string }[] | null)?.map((u) => u.id) ?? [];
    if (input.excludeUserId) recipients = recipients.filter((id) => id !== input.excludeUserId);
    if (recipients.length === 0) return;

    // Preferências: quem desligou explicitamente este tipo é removido.
    const { data: prefRows } = await supabase
      .from("notification_preferences")
      .select("user_id, in_app")
      .eq("type", input.type)
      .in("user_id", recipients);
    const optedOut = new Set(
      (prefRows as { user_id: string; in_app: boolean }[] | null)
        ?.filter((p) => p.in_app === false)
        .map((p) => p.user_id) ?? []
    );
    const targets = recipients.filter((id) => !optedOut.has(id));
    if (targets.length === 0) return;

    const rows = targets.map((userId) => ({
      company_id: input.companyId,
      user_id: userId,
      type: input.type,
      title: input.title,
      body: input.body ?? null,
      entity_type: input.entityType ?? null,
      entity_id: input.entityId ?? null,
      link: input.link ?? null,
      read_at: null,
    }));

    const { error: insertErr } = await (supabase.from("notifications") as any) // eslint-disable-line @typescript-eslint/no-explicit-any
      .insert(rows);
    if (insertErr) throw insertErr;
  } catch (err) {
    // Notificação nunca pode derrubar a mutação que a originou.
    console.error("[notifications] createNotification failed:", err);
  }
}
