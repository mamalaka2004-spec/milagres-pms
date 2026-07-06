import type { LucideIcon } from "lucide-react";
import {
  CalendarDays, Users, Home, UserCheck, DollarSign, ClipboardList,
  MessageSquare, Bot, Settings, Image as ImageIcon, Plus, Pencil,
  Trash2, ArrowRightLeft, CreditCard, RefreshCw, Activity,
} from "lucide-react";

/**
 * Human-readable labels + icons for the activity-log screen. Action codes use a
 * "entity.verb" convention; we render the entity label and a colored verb chip.
 */

export type AuditVerb = "create" | "update" | "delete" | "transition" | "charge" | "sync" | "other";

export const ENTITY_LABELS: Record<string, { label: string; icon: LucideIcon }> = {
  reservation: { label: "Reserva", icon: CalendarDays },
  guest: { label: "Hóspede", icon: Users },
  property: { label: "Imóvel", icon: Home },
  property_image: { label: "Foto de imóvel", icon: ImageIcon },
  property_amenities: { label: "Comodidades", icon: Home },
  owner: { label: "Proprietário", icon: UserCheck },
  payment: { label: "Pagamento", icon: CreditCard },
  financial_entry: { label: "Lançamento financeiro", icon: DollarSign },
  task: { label: "Tarefa", icon: ClipboardList },
  task_photo: { label: "Mídia de tarefa", icon: ImageIcon },
  checklist_template: { label: "Template de checklist", icon: ClipboardList },
  operations_settings: { label: "Config. de Operações", icon: Settings },
  user: { label: "Usuário", icon: Users },
  whatsapp_line: { label: "Linha WhatsApp", icon: MessageSquare },
  quick_reply: { label: "Resposta rápida", icon: MessageSquare },
  conversation: { label: "Conversa", icon: MessageSquare },
  lead: { label: "Lead", icon: UserCheck },
  ai_settings: { label: "Configuração de IA", icon: Bot },
  settings: { label: "Ajustes", icon: Settings },
};

export const VERB_LABELS: Record<AuditVerb, { label: string; tone: string; icon: LucideIcon }> = {
  create: { label: "Criou", tone: "text-emerald-700 bg-emerald-50", icon: Plus },
  update: { label: "Editou", tone: "text-blue-700 bg-blue-50", icon: Pencil },
  delete: { label: "Removeu", tone: "text-rose-700 bg-rose-50", icon: Trash2 },
  transition: { label: "Mudou status", tone: "text-violet-700 bg-violet-50", icon: ArrowRightLeft },
  charge: { label: "Cobrou", tone: "text-amber-700 bg-amber-50", icon: CreditCard },
  sync: { label: "Sincronizou", tone: "text-cyan-700 bg-cyan-50", icon: RefreshCw },
  other: { label: "Ação", tone: "text-gray-700 bg-gray-100", icon: Activity },
};

export function parseAction(action: string): { entityType: string; verb: AuditVerb } {
  const [entityType, rawVerb] = action.split(".");
  const verb = (["create", "update", "delete", "transition", "charge", "sync"] as AuditVerb[]).includes(
    rawVerb as AuditVerb
  )
    ? (rawVerb as AuditVerb)
    : "other";
  return { entityType: entityType || "", verb };
}

export function entityLabel(entityType: string | null): { label: string; icon: LucideIcon } {
  if (!entityType) return { label: "Sistema", icon: Activity };
  return ENTITY_LABELS[entityType] ?? { label: entityType, icon: Activity };
}
