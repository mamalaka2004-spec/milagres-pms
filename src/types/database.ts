// Auto-generated types from Supabase schema
// Run `npx supabase gen types typescript` to regenerate

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type UserRole = "admin" | "manager" | "staff";
export type PropertyStatus = "active" | "inactive" | "maintenance";
export type PropertyType = "apartment" | "house" | "studio" | "villa" | "cabin" | "room" | "other";
export type ReservationStatus = "inquiry" | "pending" | "confirmed" | "checked_in" | "checked_out" | "canceled" | "no_show";
export type PaymentStatus = "unpaid" | "partially_paid" | "paid" | "refunded";
export type PaymentMethod = "pix" | "credit_card" | "debit_card" | "bank_transfer" | "cash" | "platform" | "other";
export type Channel = "direct" | "airbnb" | "booking" | "expedia" | "vrbo" | "manual" | "other";
export type TaskStatus = "pending" | "in_progress" | "completed" | "skipped";
export type TaskType = "checkout_clean" | "checkin_prep" | "deep_clean" | "inspection" | "turnover";
export type Priority = "low" | "normal" | "high" | "urgent";
export type AiMode = "guest" | "operations" | "management";
export type BlockedDateReason = "owner_use" | "maintenance" | "cleaning" | "seasonal" | "other";
export type WaLinePurpose = "booking" | "sales" | "other";
export type WaLineProvider = "evolution" | "uazapi";
export type WaConversationStatus = "open" | "snoozed" | "closed";
export type WaMessageDirection = "inbound" | "outbound";
export type WaMessageSender = "guest" | "agent" | "ai" | "system";
export type WaMessageType = "text" | "image" | "audio" | "video" | "document" | "note" | "status";
export type WaMessageStatus = "pending" | "sent" | "delivered" | "read" | "failed";
export type WaBusinessHours = Record<
  "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun",
  { open: string; close: string } | null
>;
export type LeadStage =
  | "apresentacao"
  | "qualificacao_objetivo"
  | "qualificacao_orcamento"
  | "apresentacao_imoveis"
  | "handoff"
  | "encerramento";
export type LeadOrigem = "inbound" | "prospeccao_fria";

export const LEAD_STAGE_ORDER: LeadStage[] = [
  "apresentacao",
  "qualificacao_objetivo",
  "qualificacao_orcamento",
  "apresentacao_imoveis",
  "handoff",
  "encerramento",
];

export const LEAD_STAGE_LABELS: Record<LeadStage, string> = {
  apresentacao: "Apresentação",
  qualificacao_objetivo: "Qualificação · Objetivo",
  qualificacao_orcamento: "Qualificação · Orçamento",
  apresentacao_imoveis: "Apresentação de Imóveis",
  handoff: "Handoff",
  encerramento: "Encerramento",
};

export interface Database {
  public: {
    Tables: {
      companies: {
        Row: {
          id: string;
          name: string;
          slug: string;
          email: string | null;
          phone: string | null;
          website: string | null;
          logo_url: string | null;
          address: string | null;
          city: string | null;
          state: string | null;
          country: string;
          currency: string;
          timezone: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["companies"]["Row"], "id" | "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["companies"]["Insert"]>;
      };
      users: {
        Row: {
          id: string;
          company_id: string;
          email: string;
          full_name: string;
          phone: string | null;
          avatar_url: string | null;
          role: UserRole;
          is_active: boolean;
          language: string;
          last_login_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["users"]["Row"], "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["users"]["Insert"]>;
      };
      properties: {
        Row: {
          id: string;
          company_id: string;
          name: string;
          code: string;
          slug: string;
          status: PropertyStatus;
          type: PropertyType | null;
          address: string | null;
          neighborhood: string | null;
          city: string | null;
          state: string | null;
          country: string;
          zip_code: string | null;
          latitude: number | null;
          longitude: number | null;
          max_guests: number;
          bedrooms: number;
          beds: number;
          bathrooms: number;
          title: string | null;
          subtitle: string | null;
          description: string | null;
          short_description: string | null;
          house_rules: string | null;
          cancellation_policy: string | null;
          check_in_time: string;
          check_out_time: string;
          min_nights: number;
          max_nights: number;
          base_price_cents: number;
          cleaning_fee_cents: number;
          extra_guest_fee_cents: number;
          extra_guest_after: number;
          instant_booking_enabled: boolean;
          is_featured: boolean;
          meta_title: string | null;
          meta_description: string | null;
          cover_image_url: string | null;
          airbnb_ical_url: string | null;
          booking_ical_url: string | null;
          airbnb_listing_url: string | null;
          booking_listing_url: string | null;
          airbnb_last_synced_at: string | null;
          booking_last_synced_at: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: Omit<Database["public"]["Tables"]["properties"]["Row"], "id" | "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["properties"]["Insert"]>;
      };
      guests: {
        Row: {
          id: string;
          company_id: string;
          full_name: string;
          email: string | null;
          phone: string | null;
          document_number: string | null;
          document_type: string | null;
          date_of_birth: string | null;
          nationality: string | null;
          city: string | null;
          state: string | null;
          country: string | null;
          language: string;
          notes: string | null;
          tags: string[] | null;
          is_vip: boolean;
          total_stays: number;
          total_spent_cents: number;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["guests"]["Row"], "id" | "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["guests"]["Insert"]>;
      };
      reservations: {
        Row: {
          id: string;
          company_id: string;
          property_id: string;
          guest_id: string;
          booking_code: string;
          channel: Channel;
          channel_ref: string | null;
          check_in_date: string;
          check_out_date: string;
          nights: number;
          num_guests: number;
          num_adults: number;
          num_children: number;
          status: ReservationStatus;
          payment_status: PaymentStatus;
          base_amount_cents: number;
          cleaning_fee_cents: number;
          extra_guest_fee_cents: number;
          discount_cents: number;
          subtotal_cents: number;
          platform_fee_cents: number;
          tax_cents: number;
          total_cents: number;
          net_amount_cents: number;
          owner_payout_cents: number;
          special_requests: string | null;
          internal_notes: string | null;
          cancellation_reason: string | null;
          canceled_at: string | null;
          confirmed_at: string | null;
          checked_in_at: string | null;
          checked_out_at: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["reservations"]["Row"], "id" | "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["reservations"]["Insert"]>;
      };
      payments: {
        Row: {
          id: string;
          company_id: string;
          reservation_id: string;
          amount_cents: number;
          method: PaymentMethod;
          status: string;
          reference: string | null;
          paid_at: string | null;
          notes: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["payments"]["Row"], "id" | "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["payments"]["Insert"]>;
      };
      housekeeping_tasks: {
        Row: {
          id: string;
          company_id: string;
          property_id: string;
          reservation_id: string | null;
          type: TaskType;
          status: TaskStatus;
          priority: Priority;
          assigned_to: string | null;
          due_date: string | null;
          due_time: string | null;
          notes: string | null;
          completed_at: string | null;
          completed_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["housekeeping_tasks"]["Row"], "id" | "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["housekeeping_tasks"]["Insert"]>;
      };
      blocked_dates: {
        Row: {
          id: string;
          property_id: string;
          start_date: string;
          end_date: string;
          reason: BlockedDateReason;
          notes: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["blocked_dates"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["blocked_dates"]["Insert"]>;
      };
      ai_conversations: {
        Row: {
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
        };
        Insert: Omit<Database["public"]["Tables"]["ai_conversations"]["Row"], "id" | "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["ai_conversations"]["Insert"]>;
      };
      ai_messages: {
        Row: {
          id: string;
          conversation_id: string;
          role: "user" | "assistant" | "system" | "tool";
          content: string;
          metadata: Json | null;
          tokens_used: number | null;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["ai_messages"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["ai_messages"]["Insert"]>;
      };
      whatsapp_lines: {
        Row: {
          id: string;
          company_id: string;
          phone: string;
          label: string;
          purpose: WaLinePurpose;
          provider: WaLineProvider;
          provider_instance: string | null;
          business_hours: WaBusinessHours | null;
          ai_enabled: boolean;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["whatsapp_lines"]["Row"], "id" | "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["whatsapp_lines"]["Insert"]>;
      };
      whatsapp_line_users: {
        Row: {
          line_id: string;
          user_id: string;
          can_send: boolean;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["whatsapp_line_users"]["Row"], "created_at">;
        Update: Partial<Database["public"]["Tables"]["whatsapp_line_users"]["Insert"]>;
      };
      whatsapp_conversations: {
        Row: {
          id: string;
          company_id: string;
          line_id: string;
          guest_id: string | null;
          reservation_id: string | null;
          contact_phone: string;
          contact_name: string | null;
          status: WaConversationStatus;
          ai_active: boolean;
          last_message_text: string | null;
          last_message_at: string | null;
          unread_count: number;
          pinned: boolean;
          metadata: Json | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["whatsapp_conversations"]["Row"], "id" | "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["whatsapp_conversations"]["Insert"]>;
      };
      whatsapp_messages: {
        Row: {
          id: string;
          conversation_id: string;
          direction: WaMessageDirection;
          sender: WaMessageSender;
          sender_user_id: string | null;
          text: string | null;
          message_type: WaMessageType;
          media_url: string | null;
          media_mime_type: string | null;
          file_name: string | null;
          external_id: string | null;
          reply_to_id: string | null;
          status: WaMessageStatus;
          metadata: Json | null;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["whatsapp_messages"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["whatsapp_messages"]["Insert"]>;
      };
      whatsapp_lead_data: {
        Row: {
          conversation_id: string;
          origem: LeadOrigem | null;
          lead_stage: LeadStage | null;
          objetivo: string | null;
          orcamento: string | null;
          confidence_score: number | null;
          reasoning: string | null;
          property_of_interest: string | null;
          marcelo_handoff_at: string | null;
          closed_reason: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["whatsapp_lead_data"]["Row"], "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["whatsapp_lead_data"]["Insert"]>;
      };
    };
  };
}
