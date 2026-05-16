
-- Privatize buckets
UPDATE storage.buckets SET public = false WHERE id IN ('receipts', 'chat-photos');

-- Drop overly permissive read policies
DROP POLICY IF EXISTS public_read_receipts ON storage.objects;
DROP POLICY IF EXISTS public_read_chat_photos ON storage.objects;
DROP POLICY IF EXISTS authed_read_proof ON storage.objects;

-- Drop existing upload policies to replace with team-scoped versions
DROP POLICY IF EXISTS authed_upload_receipts ON storage.objects;
DROP POLICY IF EXISTS authed_upload_chat_photos ON storage.objects;
DROP POLICY IF EXISTS authed_upload_proof ON storage.objects;

-- Team-scoped read policies (path convention: {team_id}/...)
CREATE POLICY team_read_receipts ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'receipts'
  AND public.is_team_member(((storage.foldername(name))[1])::uuid, auth.uid())
);

CREATE POLICY team_read_chat_photos ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'chat-photos'
  AND public.is_team_member(((storage.foldername(name))[1])::uuid, auth.uid())
);

CREATE POLICY team_read_proof ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'proof-docs'
  AND public.is_team_member(((storage.foldername(name))[1])::uuid, auth.uid())
);

-- Team-scoped upload policies
CREATE POLICY team_upload_receipts ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'receipts'
  AND public.is_team_member(((storage.foldername(name))[1])::uuid, auth.uid())
);

CREATE POLICY team_upload_chat_photos ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'chat-photos'
  AND public.is_team_member(((storage.foldername(name))[1])::uuid, auth.uid())
);

CREATE POLICY team_upload_proof ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'proof-docs'
  AND public.is_team_member(((storage.foldername(name))[1])::uuid, auth.uid())
);
