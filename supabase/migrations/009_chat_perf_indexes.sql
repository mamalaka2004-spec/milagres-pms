-- ===========================================================================
-- 009 — Chat performance indexes
-- Speeds up the conversation list queries (filter by status/unread, ordering).
-- Run in the Supabase SQL Editor. Idempotent.
-- ===========================================================================

-- List filtered by status, newest first (Reservas: all/open/closed tabs).
CREATE INDEX IF NOT EXISTS idx_wa_conv_line_status
  ON public.whatsapp_conversations(line_id, status, last_message_at DESC NULLS LAST);

-- Unread filter (only the rows that matter).
CREATE INDEX IF NOT EXISTS idx_wa_conv_line_unread
  ON public.whatsapp_conversations(line_id, unread_count)
  WHERE unread_count > 0;

-- Default ordering used everywhere (pinned first, then recent).
CREATE INDEX IF NOT EXISTS idx_wa_conv_line_pinned_lastmsg
  ON public.whatsapp_conversations(line_id, pinned DESC, last_message_at DESC NULLS LAST);

-- Message thread fetch is already indexed by (conversation_id, created_at) in 005;
-- this is a safety net in case that index name differs.
CREATE INDEX IF NOT EXISTS idx_wa_msg_conv_created
  ON public.whatsapp_messages(conversation_id, created_at DESC);
