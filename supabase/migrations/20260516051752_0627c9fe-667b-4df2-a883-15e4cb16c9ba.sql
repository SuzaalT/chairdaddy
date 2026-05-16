
-- 1. user_secrets table (replaces profiles.anthropic_key)
CREATE TABLE IF NOT EXISTS public.user_secrets (
  user_id uuid PRIMARY KEY,
  anthropic_key text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.user_secrets ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_secrets_self_select ON public.user_secrets
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY user_secrets_self_insert ON public.user_secrets
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY user_secrets_self_update ON public.user_secrets
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY user_secrets_self_delete ON public.user_secrets
  FOR DELETE USING (auth.uid() = user_id);

-- Backfill from profiles
INSERT INTO public.user_secrets (user_id, anthropic_key)
SELECT id, anthropic_key FROM public.profiles WHERE anthropic_key IS NOT NULL
ON CONFLICT (user_id) DO NOTHING;

-- Remove the sensitive column from profiles
ALTER TABLE public.profiles DROP COLUMN IF EXISTS anthropic_key;

-- 2. team_invites: drop overly-permissive read
DROP POLICY IF EXISTS ti_read_any_authed ON public.team_invites;
CREATE POLICY ti_team_member_select ON public.team_invites
  FOR SELECT TO authenticated
  USING (public.is_team_member(team_id, auth.uid()));

-- 3. Storage: scoped UPDATE/DELETE policies (owner only)
DROP POLICY IF EXISTS storage_objects_owner_update ON storage.objects;
CREATE POLICY storage_objects_owner_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (owner = auth.uid())
  WITH CHECK (owner = auth.uid());

DROP POLICY IF EXISTS storage_objects_owner_delete ON storage.objects;
CREATE POLICY storage_objects_owner_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (owner = auth.uid());

-- 4. Realtime channel authorization: only team members can subscribe to team:<uuid> topics
DROP POLICY IF EXISTS realtime_team_topic_select ON realtime.messages;
CREATE POLICY realtime_team_topic_select ON realtime.messages
  FOR SELECT TO authenticated
  USING (
    (split_part(realtime.topic(), ':', 2))::uuid IN (
      SELECT team_id FROM public.team_members WHERE user_id = auth.uid()
    )
  );

-- 5. Internal email queue functions: revoke from app roles, keep service_role
REVOKE EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.delete_email(text, bigint) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM anon, authenticated, public;

-- 6. Function search_path hardening
ALTER FUNCTION public.touch_updated_at() SET search_path = public;
ALTER FUNCTION public.enqueue_email(text, jsonb) SET search_path = public;
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = public;
ALTER FUNCTION public.delete_email(text, bigint) SET search_path = public;
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = public;
