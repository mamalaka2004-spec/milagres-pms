-- ─── 033. NOTIFICAÇÕES IN-APP (#18) ───
-- Fase 8: infraestrutura de notificações internas (sino/contador no header,
-- tela de notificações, marcar como lida) + preferências por tipo.
--
-- Modelo: uma linha por (usuário, evento) — fan-out feito no servidor para os
-- usuários relevantes da empresa (admin/gerente/equipe; camareira fica de fora
-- dos gatilhos comerciais). A escrita é fire-and-forget via service-role, então
-- não há política de INSERT para clientes: só o backend cria notificações.

-- ─── 1. notifications ───
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id),
  -- Destinatário. A notificação é sempre pessoal (contador/leitura por usuário).
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  -- Tipo do evento. Casado com notification_preferences.type e com os rótulos no app.
  type TEXT NOT NULL
    CHECK (type IN ('whatsapp.message', 'reservation.created', 'reservation.canceled')),
  title TEXT NOT NULL,
  body TEXT,
  -- Entidade de origem (para deep-link/contexto), quando aplicável.
  entity_type TEXT,
  entity_id UUID,
  -- Rota interna para onde o clique leva (ex.: /reservations/<id>, /conversations).
  link TEXT,
  -- NULL = não lida. Preenchido ao marcar como lida.
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Sino/lista: "as minhas, mais recentes primeiro"; contador de não-lidas.
CREATE INDEX IF NOT EXISTS idx_notifications_user_created
  ON public.notifications (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON public.notifications (user_id) WHERE read_at IS NULL;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own notifications" ON public.notifications;
CREATE POLICY "Users read own notifications" ON public.notifications
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users update own notifications" ON public.notifications;
CREATE POLICY "Users update own notifications" ON public.notifications
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ─── 2. notification_preferences ───
-- Uma linha por (usuário, tipo). Ausência de linha = habilitado (default true).
CREATE TABLE IF NOT EXISTS public.notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL
    CHECK (type IN ('whatsapp.message', 'reservation.created', 'reservation.canceled')),
  in_app BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, type)
);

CREATE INDEX IF NOT EXISTS idx_notification_prefs_user
  ON public.notification_preferences (user_id);

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own notification prefs" ON public.notification_preferences;
CREATE POLICY "Users manage own notification prefs" ON public.notification_preferences
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE TRIGGER set_updated_at BEFORE UPDATE ON public.notification_preferences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
