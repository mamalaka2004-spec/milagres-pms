-- ============================================================
-- MILAGRES PMS — WhatsApp Media Bucket
-- Run AFTER 005_whatsapp.sql
-- Idempotent: safe to run multiple times.
-- ============================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'whatsapp-media',
  'whatsapp-media',
  true, -- public read; outbound URLs sent to WhatsApp must be reachable without auth
  26214400, -- 25MB — covers most images/audios/videos and common docs
  ARRAY[
    'image/jpeg','image/png','image/webp','image/gif',
    'audio/mpeg','audio/mp4','audio/ogg','audio/webm','audio/wav',
    'video/mp4','video/webm','video/quicktime',
    'application/pdf'
  ]
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Authenticated upload whatsapp media" ON storage.objects;
DROP POLICY IF EXISTS "Public read whatsapp media" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated delete whatsapp media" ON storage.objects;

CREATE POLICY "Authenticated upload whatsapp media"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'whatsapp-media');

CREATE POLICY "Public read whatsapp media"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'whatsapp-media');

CREATE POLICY "Authenticated delete whatsapp media"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'whatsapp-media');
