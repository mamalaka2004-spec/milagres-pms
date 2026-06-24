-- Field-worker execution for housekeeping tasks:
-- service check-in (started_at), a per-task checklist, and before/after/worker photos.

ALTER TABLE public.housekeeping_tasks
  ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS checklist JSONB NOT NULL DEFAULT '[]'::jsonb;

-- [{ "id": "uuid", "label": "Banheiro", "done": false }]
COMMENT ON COLUMN public.housekeeping_tasks.checklist IS 'Itens do checklist: [{id,label,done}]';
COMMENT ON COLUMN public.housekeeping_tasks.started_at IS 'Check-in do serviço (quando o profissional iniciou).';

CREATE TABLE IF NOT EXISTS public.task_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id),
  task_id UUID NOT NULL REFERENCES public.housekeeping_tasks(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('before', 'after', 'worker')),
  url TEXT NOT NULL,
  uploaded_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_task_photos_task ON public.task_photos(task_id);

ALTER TABLE public.task_photos ENABLE ROW LEVEL SECURITY;

-- Same-company members can read/write photos of their company's tasks.
CREATE POLICY "Company members read task photos" ON public.task_photos
  FOR SELECT USING (
    company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid())
  );
CREATE POLICY "Company members write task photos" ON public.task_photos
  FOR ALL USING (
    company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid())
  );
