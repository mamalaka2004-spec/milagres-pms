-- Payment-gateway scaffolding (Asaas-ready).
-- A "charge" is simply a payments row with status='pending' + billing_type/due_date/
-- invoice_url. When the gateway confirms payment (webhook), status flips to 'completed'.
-- All columns are nullable so existing manual payments are unaffected.

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS gateway TEXT,                 -- e.g. 'asaas' (NULL = lançamento manual)
  ADD COLUMN IF NOT EXISTS external_id TEXT,             -- charge id no gateway (ex.: Asaas payment id)
  ADD COLUMN IF NOT EXISTS billing_type TEXT,            -- PIX | BOLETO | CREDIT_CARD | UNDEFINED
  ADD COLUMN IF NOT EXISTS invoice_url TEXT,             -- link da fatura/cobrança p/ o cliente
  ADD COLUMN IF NOT EXISTS pix_payload TEXT,             -- PIX copia-e-cola
  ADD COLUMN IF NOT EXISTS due_date DATE,                -- vencimento (boleto/pix)
  ADD COLUMN IF NOT EXISTS external_status TEXT,         -- status cru do gateway
  ADD COLUMN IF NOT EXISTS synced_at TIMESTAMPTZ;        -- última sincronização via webhook

CREATE INDEX IF NOT EXISTS idx_payments_external_id ON public.payments(external_id);
CREATE INDEX IF NOT EXISTS idx_payments_gateway ON public.payments(gateway);

-- Asaas requires a "customer" per payer; cache its id on the guest to avoid recreating.
ALTER TABLE public.guests
  ADD COLUMN IF NOT EXISTS asaas_customer_id TEXT;

COMMENT ON COLUMN public.payments.gateway IS 'Gateway de pagamento (asaas). NULL = pagamento manual.';
COMMENT ON COLUMN public.payments.external_id IS 'ID da cobrança no gateway (ex.: Asaas payment id).';
COMMENT ON COLUMN public.guests.asaas_customer_id IS 'ID do cliente no Asaas (cache para criar cobranças).';
