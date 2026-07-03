-- ===========================================================================
-- 026 — Precificação em lote  ·  Fase 4
-- Run AFTER 025_ai_agents.sql. Idempotent: safe to run multiple times.
-- Project: Milagres / xmmuenaaodlqubfotwzr
-- ===========================================================================
-- Grupos de anúncios + regras de preço (temporada / dia da semana / feriado)
-- + calendário de feriados. O preço-base continua em properties.base_price_cents;
-- as regras são camadas por cima, resolvidas em runtime pelo motor
-- (src/lib/pricing/engine.ts): base → temporada → recorrente → feriado.
--
--   property_groups         — grupos de anúncios da empresa
--   property_group_members  — M2M grupo ↔ imóvel
--   holidays                — feriados (fixos recorrentes + móveis por data)
--   pricing_rules           — regras: escopo (todos|grupo|imóvel), tipo
--                             (season|recurring|holiday), ajuste (set|percent)
-- ===========================================================================

-- ─── 1. GRUPOS DE ANÚNCIOS ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.property_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT NOT NULL DEFAULT '#7c9070',
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (company_id, name)
);
CREATE INDEX IF NOT EXISTS idx_property_groups_company
  ON public.property_groups(company_id, sort_order);

CREATE OR REPLACE TRIGGER set_updated_at BEFORE UPDATE ON public.property_groups
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE IF NOT EXISTS public.property_group_members (
  group_id UUID NOT NULL REFERENCES public.property_groups(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (group_id, property_id)
);
CREATE INDEX IF NOT EXISTS idx_property_group_members_property
  ON public.property_group_members(property_id);

-- ─── 2. FERIADOS ───────────────────────────────────────────────────────────
-- recurring=true → repete todo ano no mesmo mês/dia (a data guarda um ano
-- canônico). recurring=false → vale só na data exata (feriados móveis).
CREATE TABLE IF NOT EXISTS public.holidays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  date DATE NOT NULL,
  recurring BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (company_id, date, name)
);
CREATE INDEX IF NOT EXISTS idx_holidays_company ON public.holidays(company_id, date);

-- ─── 3. REGRAS DE PREÇO ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.pricing_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('season', 'recurring', 'holiday')),
  target_type TEXT NOT NULL DEFAULT 'all' CHECK (target_type IN ('all', 'group', 'property')),
  group_id UUID REFERENCES public.property_groups(id) ON DELETE CASCADE,
  property_id UUID REFERENCES public.properties(id) ON DELETE CASCADE,
  start_date DATE,                 -- season: início (inclusivo)
  end_date DATE,                   -- season: fim (inclusivo)
  days_of_week SMALLINT[],         -- recurring: 0=domingo … 6=sábado
  adjustment_type TEXT NOT NULL CHECK (adjustment_type IN ('set', 'percent')),
  price_cents INT,                 -- set: preço fixo da noite
  percent NUMERIC(6,2),            -- percent: ±% sobre a camada anterior
  min_nights INT,                  -- override opcional de mínimo de noites
  priority INT NOT NULL DEFAULT 0, -- desempate dentro da mesma camada (maior vence)
  active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT pricing_rules_target_chk CHECK (
    (target_type = 'all'      AND group_id IS NULL     AND property_id IS NULL) OR
    (target_type = 'group'    AND group_id IS NOT NULL AND property_id IS NULL) OR
    (target_type = 'property' AND property_id IS NOT NULL AND group_id IS NULL)
  ),
  CONSTRAINT pricing_rules_kind_chk CHECK (
    (kind = 'season'    AND start_date IS NOT NULL AND end_date IS NOT NULL AND start_date <= end_date) OR
    (kind = 'recurring' AND days_of_week IS NOT NULL AND array_length(days_of_week, 1) > 0) OR
    (kind = 'holiday')
  ),
  CONSTRAINT pricing_rules_adjustment_chk CHECK (
    (adjustment_type = 'set'     AND price_cents IS NOT NULL AND price_cents >= 0) OR
    (adjustment_type = 'percent' AND percent IS NOT NULL AND percent > -100)
  )
);
CREATE INDEX IF NOT EXISTS idx_pricing_rules_company
  ON public.pricing_rules(company_id, active);
CREATE INDEX IF NOT EXISTS idx_pricing_rules_group
  ON public.pricing_rules(group_id) WHERE group_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pricing_rules_property
  ON public.pricing_rules(property_id) WHERE property_id IS NOT NULL;

CREATE OR REPLACE TRIGGER set_updated_at BEFORE UPDATE ON public.pricing_rules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── 4. RLS (mesmo gate de company das demais tabelas) ─────────────────────
ALTER TABLE public.property_groups        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.holidays               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pricing_rules          ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "property groups same company" ON public.property_groups;
CREATE POLICY "property groups same company" ON public.property_groups FOR ALL TO authenticated
  USING (company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid()))
  WITH CHECK (company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid()));

DROP POLICY IF EXISTS "group members via group company" ON public.property_group_members;
CREATE POLICY "group members via group company" ON public.property_group_members FOR ALL TO authenticated
  USING (group_id IN (
    SELECT id FROM public.property_groups
    WHERE company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid())))
  WITH CHECK (group_id IN (
    SELECT id FROM public.property_groups
    WHERE company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid())));

DROP POLICY IF EXISTS "holidays same company" ON public.holidays;
CREATE POLICY "holidays same company" ON public.holidays FOR ALL TO authenticated
  USING (company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid()))
  WITH CHECK (company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid()));

DROP POLICY IF EXISTS "pricing rules same company" ON public.pricing_rules;
CREATE POLICY "pricing rules same company" ON public.pricing_rules FOR ALL TO authenticated
  USING (company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid()))
  WITH CHECK (company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid()));

-- ─── 5. SEED: feriados nacionais BR por empresa (idempotente) ──────────────
-- Fixos entram como recorrentes (ano canônico 2026); móveis (Carnaval, Sexta-
-- feira Santa, Corpus Christi) entram datados para 2026 e 2027.
DO $$
DECLARE
  c RECORD;
BEGIN
  FOR c IN SELECT id FROM public.companies LOOP
    INSERT INTO public.holidays (company_id, name, date, recurring) VALUES
      (c.id, 'Confraternização Universal', '2026-01-01', true),
      (c.id, 'Tiradentes',                 '2026-04-21', true),
      (c.id, 'Dia do Trabalho',            '2026-05-01', true),
      (c.id, 'Independência do Brasil',    '2026-09-07', true),
      (c.id, 'Nossa Senhora Aparecida',    '2026-10-12', true),
      (c.id, 'Finados',                    '2026-11-02', true),
      (c.id, 'Proclamação da República',   '2026-11-15', true),
      (c.id, 'Dia da Consciência Negra',   '2026-11-20', true),
      (c.id, 'Natal',                      '2026-12-25', true),
      (c.id, 'Carnaval (segunda)',         '2026-02-16', false),
      (c.id, 'Carnaval (terça)',           '2026-02-17', false),
      (c.id, 'Sexta-feira Santa',          '2026-04-03', false),
      (c.id, 'Corpus Christi',             '2026-06-04', false),
      (c.id, 'Carnaval (segunda)',         '2027-02-08', false),
      (c.id, 'Carnaval (terça)',           '2027-02-09', false),
      (c.id, 'Sexta-feira Santa',          '2027-03-26', false),
      (c.id, 'Corpus Christi',             '2027-05-27', false)
    ON CONFLICT (company_id, date, name) DO NOTHING;
  END LOOP;
END $$;

-- ===========================================================================
-- FIM 026. Fase 4: precificação em lote + tarifa sugerida da Análise de Mercado.
-- ===========================================================================
