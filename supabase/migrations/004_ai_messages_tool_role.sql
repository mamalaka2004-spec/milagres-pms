-- 004_ai_messages_tool_role.sql
-- Allow role='tool' on ai_messages so OpenAI tool-call results can be persisted.
-- Without this, any AI question that triggers a function call crashes with:
--   "new row for relation \"ai_messages\" violates check constraint \"ai_messages_role_check\""

ALTER TABLE public.ai_messages
  DROP CONSTRAINT IF EXISTS ai_messages_role_check;

ALTER TABLE public.ai_messages
  ADD CONSTRAINT ai_messages_role_check
  CHECK (role IN ('user', 'assistant', 'system', 'tool'));
