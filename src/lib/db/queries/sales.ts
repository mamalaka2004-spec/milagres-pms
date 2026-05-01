import { createAdminClient } from "@/lib/supabase/admin";
import type { Database, LeadStage, LeadOrigem } from "@/types/database";

type LeadDataRow = Database["public"]["Tables"]["whatsapp_lead_data"]["Row"];
type ConvRow = Database["public"]["Tables"]["whatsapp_conversations"]["Row"];

export type SalesConversationRow = ConvRow & {
  lead_data: LeadDataRow | null;
};

export async function listSalesConversations(lineId: string): Promise<SalesConversationRow[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("whatsapp_conversations")
    .select("*, lead_data:whatsapp_lead_data(*)")
    .eq("line_id", lineId)
    .order("pinned", { ascending: false })
    .order("last_message_at", { ascending: false, nullsFirst: false });
  if (error) throw error;
  // PostgREST returns the joined row as an object (since it's a 1:1 via PK FK).
  return ((data as unknown as SalesConversationRow[]) || []).map((c) => ({
    ...c,
    lead_data: Array.isArray(c.lead_data) ? c.lead_data[0] || null : c.lead_data,
  }));
}

export async function getLeadData(conversationId: string): Promise<LeadDataRow | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("whatsapp_lead_data")
    .select("*")
    .eq("conversation_id", conversationId)
    .maybeSingle();
  return (data as LeadDataRow | null) ?? null;
}

export async function upsertLeadData(opts: {
  conversationId: string;
  origem?: LeadOrigem | null;
  leadStage?: LeadStage | null;
  objetivo?: string | null;
  orcamento?: string | null;
  confidenceScore?: number | null;
  reasoning?: string | null;
  propertyOfInterest?: string | null;
  marceloHandoffAt?: string | null;
  closedReason?: string | null;
}): Promise<LeadDataRow> {
  const supabase = createAdminClient();
  const patch: Record<string, unknown> = {
    conversation_id: opts.conversationId,
    updated_at: new Date().toISOString(),
  };
  if (opts.origem !== undefined) patch.origem = opts.origem;
  if (opts.leadStage !== undefined) patch.lead_stage = opts.leadStage;
  if (opts.objetivo !== undefined) patch.objetivo = opts.objetivo;
  if (opts.orcamento !== undefined) patch.orcamento = opts.orcamento;
  if (opts.confidenceScore !== undefined) patch.confidence_score = opts.confidenceScore;
  if (opts.reasoning !== undefined) patch.reasoning = opts.reasoning;
  if (opts.propertyOfInterest !== undefined) patch.property_of_interest = opts.propertyOfInterest;
  if (opts.marceloHandoffAt !== undefined) patch.marcelo_handoff_at = opts.marceloHandoffAt;
  if (opts.closedReason !== undefined) patch.closed_reason = opts.closedReason;

  const { data, error } = await (supabase.from("whatsapp_lead_data") as any) // eslint-disable-line @typescript-eslint/no-explicit-any
    .upsert(patch, { onConflict: "conversation_id" })
    .select()
    .single();
  if (error) throw error;
  return data as LeadDataRow;
}
