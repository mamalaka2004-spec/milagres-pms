// Notificações in-app (#18) — tipos e rótulos compartilhados (server + client).

export const NOTIFICATION_TYPES = [
  "whatsapp.message",
  "reservation.created",
  "reservation.canceled",
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export interface NotificationTypeMeta {
  /** Rótulo curto para o toggle de preferências. */
  label: string;
  /** Descrição do gatilho (linha de apoio nas preferências). */
  description: string;
}

export const NOTIFICATION_TYPE_META: Record<NotificationType, NotificationTypeMeta> = {
  "whatsapp.message": {
    label: "Novas mensagens WhatsApp",
    description: "Quando um contato envia uma nova mensagem no chat.",
  },
  "reservation.created": {
    label: "Novas reservas",
    description: "Quando uma reserva é criada (pelo site ou manualmente).",
  },
  "reservation.canceled": {
    label: "Cancelamentos",
    description: "Quando uma reserva é cancelada.",
  },
};

/** Papéis que recebem notificações comerciais por padrão (camareira fica de fora). */
export const NOTIFIABLE_ROLES = ["admin", "manager", "staff"] as const;
