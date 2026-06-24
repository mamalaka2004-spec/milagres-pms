-- Per-line Evolution instance token.
-- Each WhatsApp line maps to its own Evolution instance, which has its own API token.
-- Storing the token per line lets the PMS manage each instance (connection state, QR
-- reconnect, sending) WITHOUT using the server-wide global key — which would grant
-- access to every instance on the shared Evolution server (other tenants included).
-- When NULL, the code falls back to the env EVOLUTION_API_KEY.
ALTER TABLE public.whatsapp_lines
  ADD COLUMN IF NOT EXISTS provider_token TEXT;

COMMENT ON COLUMN public.whatsapp_lines.provider_token IS
  'Evolution instance API token for this line. NULL → falls back to env EVOLUTION_API_KEY.';
