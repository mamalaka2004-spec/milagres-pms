-- 019_company_ai_master.sql
-- System-level (company) master switch for the WhatsApp AI assistant.
-- This is the TOP of the AI hierarchy: System (company.ai_enabled)
--   → Line (whatsapp_lines.ai_enabled)
--   → Conversation (whatsapp_conversations.ai_active).
-- When the master is OFF, the AI never auto-replies on any line/conversation,
-- regardless of the lower-level switches. Defaults OFF so nothing auto-replies
-- until an admin explicitly turns the system on.

ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS ai_enabled boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN companies.ai_enabled IS
  'Master AI switch (top of hierarchy). When false, AI auto-reply is disabled system-wide.';
