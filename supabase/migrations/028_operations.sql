-- Fase 6 — Operações / Camareira (#13, #14)
-- Role 'camareira', templates de checklist configuráveis, vídeo em task_photos,
-- bucket dedicado de mídia de tarefas (com caminho salvo para o job de retenção).

-- ─── 1. Role 'camareira' ───
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE public.users
  ADD CONSTRAINT users_role_check CHECK (role IN ('admin', 'manager', 'staff', 'camareira'));

-- ─── 2. Templates de checklist ───
CREATE TABLE IF NOT EXISTS public.checklist_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id),
  name TEXT NOT NULL,
  task_type TEXT NOT NULL DEFAULT 'checkout_clean'
    CHECK (task_type IN ('checkout_clean', 'checkin_prep', 'deep_clean', 'inspection', 'turnover')),
  -- Itens do template: [{id, label}] — o "done" vive na cópia do checklist da tarefa.
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Unidades onde o template vale. Vazio = todas as unidades da empresa.
  property_ids UUID[] NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_checklist_templates_company
  ON public.checklist_templates(company_id, task_type);

ALTER TABLE public.checklist_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Company members read checklist templates" ON public.checklist_templates;
CREATE POLICY "Company members read checklist templates" ON public.checklist_templates
  FOR SELECT USING (
    company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid())
  );
DROP POLICY IF EXISTS "Admin can manage checklist templates" ON public.checklist_templates;
CREATE POLICY "Admin can manage checklist templates" ON public.checklist_templates
  FOR ALL USING (
    company_id IN (
      SELECT company_id FROM public.users
      WHERE id = auth.uid() AND role IN ('admin', 'manager')
    )
  );

-- ─── 3. task_photos: vídeo + localização no storage (para retenção #14) ───
ALTER TABLE public.task_photos
  ADD COLUMN IF NOT EXISTS media_type TEXT NOT NULL DEFAULT 'image'
    CHECK (media_type IN ('image', 'video')),
  ADD COLUMN IF NOT EXISTS storage_bucket TEXT,
  ADD COLUMN IF NOT EXISTS storage_path TEXT;
COMMENT ON COLUMN public.task_photos.storage_path IS
  'Caminho do objeto no bucket (usado pela retenção). Linhas antigas (NULL): derivado da URL pública.';

-- ─── 4. Bucket dedicado de mídia de tarefas (imagens + vídeos, upload via signed URL) ───
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'task-media', 'task-media', true, 104857600,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime', 'video/webm']
)
ON CONFLICT (id) DO NOTHING;

-- ─── 5. Seed: templates de exemplo por empresa (editáveis em Ajustes → Operações) ───
INSERT INTO public.checklist_templates (company_id, name, task_type, items)
SELECT
  c.id,
  'Limpeza de saída — padrão',
  'checkout_clean',
  '[
    {"id": "quartos",   "label": "Quarto(s)"},
    {"id": "banheiros", "label": "Banheiro(s)"},
    {"id": "cozinha",   "label": "Cozinha"},
    {"id": "cama",      "label": "Roupa de cama trocada"},
    {"id": "toalhas",   "label": "Toalhas trocadas"},
    {"id": "lixo",      "label": "Lixo recolhido"},
    {"id": "amenities", "label": "Amenities repostos"},
    {"id": "piso",      "label": "Piso/varanda"}
  ]'::jsonb
FROM public.companies c
WHERE NOT EXISTS (
  SELECT 1 FROM public.checklist_templates t
  WHERE t.company_id = c.id AND t.task_type = 'checkout_clean'
);

INSERT INTO public.checklist_templates (company_id, name, task_type, items)
SELECT
  c.id,
  'Preparo de entrada — padrão',
  'checkin_prep',
  '[
    {"id": "limpeza",   "label": "Conferir limpeza"},
    {"id": "cama",      "label": "Roupa de cama"},
    {"id": "toalhas",   "label": "Toalhas"},
    {"id": "amenities", "label": "Amenities"},
    {"id": "cortesia",  "label": "Água/cortesia"},
    {"id": "clima",     "label": "Ar/iluminação ok"},
    {"id": "acesso",    "label": "Chaves/acesso"}
  ]'::jsonb
FROM public.companies c
WHERE NOT EXISTS (
  SELECT 1 FROM public.checklist_templates t
  WHERE t.company_id = c.id AND t.task_type = 'checkin_prep'
);
