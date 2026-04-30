-- ============================================================
-- MILAGRES PMS — WhatsApp Conversations Module
-- Run AFTER 004_ai_messages_tool_role.sql
-- Idempotent: safe to run multiple times.
-- ============================================================
-- Adds:
--   * whatsapp_lines       — one row per connected WhatsApp number (booking, sales, ...)
--   * whatsapp_line_users  — per-line access permission junction
--   * whatsapp_conversations — one row per (line, contact_phone)
--   * whatsapp_messages    — chronological log per conversation
-- ============================================================

-- ─── 1. WHATSAPP LINES ───
CREATE TABLE IF NOT EXISTS public.whatsapp_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,                       -- E.164 format, e.g. +5582999999999
  label TEXT NOT NULL,                       -- "Reservas", "Vendas", ...
  purpose TEXT NOT NULL CHECK (purpose IN ('booking', 'sales', 'other')),
  provider TEXT NOT NULL DEFAULT 'evolution' CHECK (provider IN ('evolution', 'uazapi')),
  provider_instance TEXT,                    -- Evolution instance name OR uazapi token id
  business_hours JSONB,                      -- {"mon":{"open":"08:00","close":"20:00"},"tue":...,"sun":null}
  ai_enabled BOOLEAN NOT NULL DEFAULT false, -- master switch for auto-reply on this line
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (company_id, phone)
);
CREATE INDEX IF NOT EXISTS idx_whatsapp_lines_company ON public.whatsapp_lines(company_id);

-- ─── 2. PER-LINE USER ACCESS ───
CREATE TABLE IF NOT EXISTS public.whatsapp_line_users (
  line_id UUID NOT NULL REFERENCES public.whatsapp_lines(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  can_send BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (line_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_whatsapp_line_users_user ON public.whatsapp_line_users(user_id);

-- ─── 3. CONVERSATIONS ───
CREATE TABLE IF NOT EXISTS public.whatsapp_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  line_id UUID NOT NULL REFERENCES public.whatsapp_lines(id) ON DELETE CASCADE,
  guest_id UUID REFERENCES public.guests(id) ON DELETE SET NULL,
  reservation_id UUID REFERENCES public.reservations(id) ON DELETE SET NULL,
  contact_phone TEXT NOT NULL,               -- E.164
  contact_name TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'snoozed', 'closed')),
  ai_active BOOLEAN NOT NULL DEFAULT true,   -- per-conversation toggle (line.ai_enabled is the master)
  last_message_text TEXT,
  last_message_at TIMESTAMPTZ,
  unread_count INT NOT NULL DEFAULT 0,
  pinned BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (line_id, contact_phone)            -- one conversation per (line, contact)
);
CREATE INDEX IF NOT EXISTS idx_wa_conv_company ON public.whatsapp_conversations(company_id);
CREATE INDEX IF NOT EXISTS idx_wa_conv_line_lastmsg ON public.whatsapp_conversations(line_id, last_message_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_wa_conv_guest ON public.whatsapp_conversations(guest_id) WHERE guest_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_wa_conv_reservation ON public.whatsapp_conversations(reservation_id) WHERE reservation_id IS NOT NULL;

-- ─── 4. MESSAGES ───
CREATE TABLE IF NOT EXISTS public.whatsapp_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.whatsapp_conversations(id) ON DELETE CASCADE,
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  sender TEXT NOT NULL CHECK (sender IN ('guest', 'agent', 'ai', 'system')),
  sender_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  text TEXT,
  message_type TEXT NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'audio', 'video', 'document', 'note', 'status')),
  media_url TEXT,
  media_mime_type TEXT,
  file_name TEXT,
  external_id TEXT,                          -- Evolution key.id (or provider equivalent) — for dedup
  reply_to_id UUID REFERENCES public.whatsapp_messages(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'sent' CHECK (status IN ('pending', 'sent', 'delivered', 'read', 'failed')),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_wa_msg_conv_created ON public.whatsapp_messages(conversation_id, created_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_wa_msg_external_id
  ON public.whatsapp_messages(conversation_id, external_id)
  WHERE external_id IS NOT NULL;

-- ─── 5. RLS ───
ALTER TABLE public.whatsapp_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_line_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;

-- Lines: user must be granted access via whatsapp_line_users OR be admin/manager of the company
DROP POLICY IF EXISTS "Users can view assigned lines" ON public.whatsapp_lines;
CREATE POLICY "Users can view assigned lines" ON public.whatsapp_lines
  FOR SELECT USING (
    id IN (SELECT line_id FROM public.whatsapp_line_users WHERE user_id = auth.uid())
    OR
    company_id IN (
      SELECT company_id FROM public.users
      WHERE id = auth.uid() AND role IN ('admin', 'manager')
    )
  );

DROP POLICY IF EXISTS "Admin manages lines" ON public.whatsapp_lines;
CREATE POLICY "Admin manages lines" ON public.whatsapp_lines
  FOR ALL USING (
    company_id IN (
      SELECT company_id FROM public.users
      WHERE id = auth.uid() AND role IN ('admin', 'manager')
    )
  );

-- Line-users junction: visible to admins of same company
DROP POLICY IF EXISTS "Admin manages line users" ON public.whatsapp_line_users;
CREATE POLICY "Admin manages line users" ON public.whatsapp_line_users
  FOR ALL USING (
    line_id IN (
      SELECT id FROM public.whatsapp_lines
      WHERE company_id IN (
        SELECT company_id FROM public.users
        WHERE id = auth.uid() AND role IN ('admin', 'manager')
      )
    )
  );

-- Conversations: user must have access to the line
DROP POLICY IF EXISTS "Users can view conversations on accessible lines" ON public.whatsapp_conversations;
CREATE POLICY "Users can view conversations on accessible lines" ON public.whatsapp_conversations
  FOR SELECT USING (
    line_id IN (SELECT line_id FROM public.whatsapp_line_users WHERE user_id = auth.uid())
    OR
    company_id IN (
      SELECT company_id FROM public.users
      WHERE id = auth.uid() AND role IN ('admin', 'manager')
    )
  );

-- Messages: same gate as their parent conversation
DROP POLICY IF EXISTS "Users can view messages of accessible conversations" ON public.whatsapp_messages;
CREATE POLICY "Users can view messages of accessible conversations" ON public.whatsapp_messages
  FOR SELECT USING (
    conversation_id IN (
      SELECT id FROM public.whatsapp_conversations
      WHERE line_id IN (SELECT line_id FROM public.whatsapp_line_users WHERE user_id = auth.uid())
        OR company_id IN (
          SELECT company_id FROM public.users
          WHERE id = auth.uid() AND role IN ('admin', 'manager')
        )
    )
  );

-- Writes go through service-role (admin client) from API routes — no INSERT/UPDATE policies needed.
