import { createAdminClient } from "@/lib/supabase/admin";
import type { AiMode, Json } from "@/types/database";

// AI conversation persistence runs server-side under requireAuth — we use the
// admin client to bypass RLS on these tables (RLS adds no security value here
// since the route already verifies company_id, and INSERT policies don't exist
// in the original schema).

export interface ConversationRow {
  id: string;
  company_id: string;
  user_id: string | null;
  mode: AiMode;
  title: string | null;
  context: Json | null;
  language: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface MessageRow {
  id: string;
  conversation_id: string;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  metadata: Json | null;
  tokens_used: number | null;
  created_at: string;
}

export async function getOrCreateConversation(opts: {
  conversationId?: string | null;
  companyId: string;
  userId: string;
  mode: AiMode;
  language?: string;
}): Promise<ConversationRow> {
  const supabase = createAdminClient();

  if (opts.conversationId) {
    const { data, error } = await supabase
      .from("ai_conversations")
      .select("*")
      .eq("id", opts.conversationId)
      .single();
    if (error) throw error;
    const row = data as unknown as ConversationRow;
    if (row.company_id !== opts.companyId) {
      throw new Error("Conversation belongs to a different company");
    }
    return row;
  }

  const { data, error } = await (supabase.from("ai_conversations") as any) // eslint-disable-line @typescript-eslint/no-explicit-any
    .insert({
      company_id: opts.companyId,
      user_id: opts.userId,
      mode: opts.mode,
      language: opts.language || "pt-BR",
      is_active: true,
      context: {},
    })
    .select()
    .single();
  if (error) throw error;
  return data as ConversationRow;
}

export async function listMessages(conversationId: string, limit = 60): Promise<MessageRow[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("ai_messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error) throw error;
  return (data as unknown as MessageRow[]) || [];
}

export async function appendMessage(
  conversationId: string,
  role: MessageRow["role"],
  content: string,
  meta?: { metadata?: Json; tokens_used?: number }
): Promise<MessageRow> {
  const supabase = createAdminClient();
  const { data, error } = await (supabase.from("ai_messages") as any) // eslint-disable-line @typescript-eslint/no-explicit-any
    .insert({
      conversation_id: conversationId,
      role,
      content,
      metadata: meta?.metadata ?? null,
      tokens_used: meta?.tokens_used ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return data as MessageRow;
}

export async function updateConversationTitle(conversationId: string, title: string) {
  const supabase = createAdminClient();
  await (supabase.from("ai_conversations") as any) // eslint-disable-line @typescript-eslint/no-explicit-any
    .update({ title })
    .eq("id", conversationId);
}
