import { createAdminClient } from "@/lib/supabase/admin";
import type {
  Database,
  WaConversationStatus,
  WaMessageDirection,
  WaMessageSender,
  WaMessageType,
  WaMessageStatus,
  Json,
} from "@/types/database";

type LineRow = Database["public"]["Tables"]["whatsapp_lines"]["Row"];
type ConvRow = Database["public"]["Tables"]["whatsapp_conversations"]["Row"];
type MsgRow = Database["public"]["Tables"]["whatsapp_messages"]["Row"];

/* ─────────────────────── LINES ─────────────────────── */

export async function listLinesForUser(userId: string, companyId: string): Promise<LineRow[]> {
  const supabase = createAdminClient();
  // First check if the user is admin/manager of the company → all company lines.
  const { data: u } = await supabase
    .from("users")
    .select("role")
    .eq("id", userId)
    .maybeSingle();
  const role = (u as { role?: string } | null)?.role;

  if (role === "admin" || role === "manager") {
    const { data, error } = await supabase
      .from("whatsapp_lines")
      .select("*")
      .eq("company_id", companyId)
      .order("created_at");
    if (error) throw error;
    return (data as LineRow[]) || [];
  }

  // Otherwise: only lines explicitly granted via whatsapp_line_users.
  const { data: grants, error: grantsErr } = await supabase
    .from("whatsapp_line_users")
    .select("line_id")
    .eq("user_id", userId);
  if (grantsErr) throw grantsErr;
  const ids = ((grants as { line_id: string }[]) || []).map((g) => g.line_id);
  if (ids.length === 0) return [];
  const { data, error } = await supabase
    .from("whatsapp_lines")
    .select("*")
    .in("id", ids)
    .eq("company_id", companyId)
    .order("created_at");
  if (error) throw error;
  return (data as LineRow[]) || [];
}

export async function getLineByPhone(companyId: string, phone: string): Promise<LineRow | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("whatsapp_lines")
    .select("*")
    .eq("company_id", companyId)
    .eq("phone", phone)
    .maybeSingle();
  return (data as LineRow | null) ?? null;
}

/* ─────────────────────── CONVERSATIONS ─────────────────────── */

export interface ConversationFilters {
  status?: WaConversationStatus;
  unread_only?: boolean;
  search?: string;
}

export async function listConversations(
  lineId: string,
  filters: ConversationFilters = {}
): Promise<ConvRow[]> {
  const supabase = createAdminClient();
  let query = supabase
    .from("whatsapp_conversations")
    .select("*")
    .eq("line_id", lineId)
    .order("pinned", { ascending: false })
    .order("last_message_at", { ascending: false, nullsFirst: false });

  if (filters.status) query = query.eq("status", filters.status);
  if (filters.unread_only) query = query.gt("unread_count", 0);
  if (filters.search) {
    const term = filters.search.replace(/[%,()*_:]/g, "").slice(0, 80);
    if (term.length > 0) {
      query = query.or(`contact_name.ilike.%${term}%,contact_phone.ilike.%${term}%,last_message_text.ilike.%${term}%`);
    }
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data as ConvRow[]) || [];
}

export async function getConversationById(id: string): Promise<ConvRow | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("whatsapp_conversations")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  return (data as ConvRow | null) ?? null;
}

export async function findOrCreateConversation(opts: {
  companyId: string;
  lineId: string;
  contactPhone: string;
  contactName?: string | null;
}): Promise<ConvRow> {
  const supabase = createAdminClient();
  const { data: existing } = await supabase
    .from("whatsapp_conversations")
    .select("*")
    .eq("line_id", opts.lineId)
    .eq("contact_phone", opts.contactPhone)
    .maybeSingle();
  if (existing) {
    if (opts.contactName && !(existing as ConvRow).contact_name) {
      await (supabase.from("whatsapp_conversations") as any) // eslint-disable-line @typescript-eslint/no-explicit-any
        .update({ contact_name: opts.contactName })
        .eq("id", (existing as ConvRow).id);
    }
    return existing as ConvRow;
  }

  // Try to auto-link to a guest by phone (best-effort within company).
  let guestId: string | null = null;
  const { data: g } = await supabase
    .from("guests")
    .select("id")
    .eq("company_id", opts.companyId)
    .eq("phone", opts.contactPhone)
    .maybeSingle();
  if (g) guestId = (g as { id: string }).id;

  const { data, error } = await (supabase.from("whatsapp_conversations") as any) // eslint-disable-line @typescript-eslint/no-explicit-any
    .insert({
      company_id: opts.companyId,
      line_id: opts.lineId,
      contact_phone: opts.contactPhone,
      contact_name: opts.contactName ?? null,
      guest_id: guestId,
      status: "open",
      ai_active: true,
      unread_count: 0,
      pinned: false,
    })
    .select()
    .single();
  if (error) throw error;
  return data as ConvRow;
}

export async function updateConversation(
  id: string,
  patch: Partial<{
    status: WaConversationStatus;
    pinned: boolean;
    ai_active: boolean;
    guest_id: string | null;
    reservation_id: string | null;
    contact_name: string | null;
    unread_count: number;
  }>
): Promise<ConvRow> {
  const supabase = createAdminClient();
  const { data, error } = await (supabase.from("whatsapp_conversations") as any) // eslint-disable-line @typescript-eslint/no-explicit-any
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as ConvRow;
}

/* ─────────────────────── MESSAGES ─────────────────────── */

export async function listMessages(conversationId: string, limit = 60, before?: string): Promise<MsgRow[]> {
  const supabase = createAdminClient();
  let q = supabase
    .from("whatsapp_messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (before) q = q.lt("created_at", before);
  const { data, error } = await q;
  if (error) throw error;
  return ((data as MsgRow[]) || []).reverse(); // oldest-first for UI
}

export async function appendMessage(opts: {
  conversationId: string;
  direction: WaMessageDirection;
  sender: WaMessageSender;
  senderUserId?: string | null;
  text?: string | null;
  messageType?: WaMessageType;
  mediaUrl?: string | null;
  mediaMimeType?: string | null;
  fileName?: string | null;
  externalId?: string | null;
  replyToId?: string | null;
  status?: WaMessageStatus;
  metadata?: Json | null;
  bumpUnread?: boolean; // inbound from guest → +1; outbound or status messages → no bump
}): Promise<MsgRow> {
  const supabase = createAdminClient();

  // Dedup on externalId (Evolution sometimes redelivers events).
  if (opts.externalId) {
    const { data: dup } = await supabase
      .from("whatsapp_messages")
      .select("*")
      .eq("conversation_id", opts.conversationId)
      .eq("external_id", opts.externalId)
      .maybeSingle();
    if (dup) return dup as MsgRow;
  }

  const insertRow = {
    conversation_id: opts.conversationId,
    direction: opts.direction,
    sender: opts.sender,
    sender_user_id: opts.senderUserId ?? null,
    text: opts.text ?? null,
    message_type: opts.messageType ?? "text",
    media_url: opts.mediaUrl ?? null,
    media_mime_type: opts.mediaMimeType ?? null,
    file_name: opts.fileName ?? null,
    external_id: opts.externalId ?? null,
    reply_to_id: opts.replyToId ?? null,
    status: opts.status ?? "sent",
    metadata: opts.metadata ?? {},
  };

  const { data, error } = await (supabase.from("whatsapp_messages") as any) // eslint-disable-line @typescript-eslint/no-explicit-any
    .insert(insertRow)
    .select()
    .single();
  if (error) throw error;

  // Update conversation last_message_* + unread_count.
  const preview = opts.text ?? `[${opts.messageType ?? "media"}]`;
  const updates: Record<string, unknown> = {
    last_message_text: preview.slice(0, 280),
    last_message_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  if (opts.bumpUnread) {
    const { data: c } = await supabase
      .from("whatsapp_conversations")
      .select("unread_count")
      .eq("id", opts.conversationId)
      .maybeSingle();
    const cur = (c as { unread_count?: number } | null)?.unread_count ?? 0;
    updates.unread_count = cur + 1;
  }
  await (supabase.from("whatsapp_conversations") as any) // eslint-disable-line @typescript-eslint/no-explicit-any
    .update(updates)
    .eq("id", opts.conversationId);

  return data as MsgRow;
}

export async function markConversationRead(conversationId: string): Promise<void> {
  const supabase = createAdminClient();
  await (supabase.from("whatsapp_conversations") as any) // eslint-disable-line @typescript-eslint/no-explicit-any
    .update({ unread_count: 0, updated_at: new Date().toISOString() })
    .eq("id", conversationId);
}
