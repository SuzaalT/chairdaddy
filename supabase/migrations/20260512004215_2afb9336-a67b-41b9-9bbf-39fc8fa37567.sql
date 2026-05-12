-- Role permissions table
CREATE TABLE public.role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  role public.team_role NOT NULL,
  permission TEXT NOT NULL,
  allowed BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(team_id, role, permission)
);

ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rp_team_select" ON public.role_permissions
  FOR SELECT USING (public.is_team_member(team_id, auth.uid()));

CREATE POLICY "rp_owner_all" ON public.role_permissions
  FOR ALL USING (
    EXISTS(SELECT 1 FROM public.teams t WHERE t.id = team_id AND t.owner_id = auth.uid())
  ) WITH CHECK (
    EXISTS(SELECT 1 FROM public.teams t WHERE t.id = team_id AND t.owner_id = auth.uid())
  );

-- has_permission function
CREATE OR REPLACE FUNCTION public.has_permission(_team_id UUID, _user_id UUID, _permission TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _is_owner BOOLEAN;
  _role public.team_role;
  _allowed BOOLEAN;
BEGIN
  IF _user_id IS NULL OR _team_id IS NULL THEN RETURN FALSE; END IF;
  SELECT (owner_id = _user_id) INTO _is_owner FROM public.teams WHERE id = _team_id;
  IF _is_owner THEN RETURN TRUE; END IF;
  SELECT role INTO _role FROM public.team_members WHERE team_id = _team_id AND user_id = _user_id;
  IF _role IS NULL THEN RETURN FALSE; END IF;
  IF _role = 'owner' THEN RETURN TRUE; END IF;
  SELECT allowed INTO _allowed FROM public.role_permissions
    WHERE team_id = _team_id AND role = _role AND permission = _permission;
  RETURN COALESCE(_allowed, FALSE);
END $$;

-- Seed defaults for a team
CREATE OR REPLACE FUNCTION public.seed_role_permissions(_team_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  perms TEXT[] := ARRAY['chair.delete','chair.edit','expense.delete','expense.edit','team.invite','team.manage_roles','chat.delete_others','location.view_others'];
  p TEXT;
BEGIN
  FOREACH p IN ARRAY perms LOOP
    -- co_owner: everything except manage_roles
    INSERT INTO public.role_permissions(team_id, role, permission, allowed)
    VALUES (_team_id, 'co_owner', p, p <> 'team.manage_roles')
    ON CONFLICT (team_id, role, permission) DO NOTHING;
    -- partner: edit + delete chairs/expenses + view locations
    INSERT INTO public.role_permissions(team_id, role, permission, allowed)
    VALUES (_team_id, 'partner', p, p IN ('chair.delete','chair.edit','expense.edit','location.view_others'))
    ON CONFLICT DO NOTHING;
    -- staff: edit only + view locations
    INSERT INTO public.role_permissions(team_id, role, permission, allowed)
    VALUES (_team_id, 'staff', p, p IN ('chair.edit','expense.edit','location.view_others'))
    ON CONFLICT DO NOTHING;
    -- viewer: nothing
    INSERT INTO public.role_permissions(team_id, role, permission, allowed)
    VALUES (_team_id, 'viewer', p, FALSE)
    ON CONFLICT DO NOTHING;
  END LOOP;
END $$;

-- Backfill existing teams
DO $$ DECLARE t RECORD; BEGIN
  FOR t IN SELECT id FROM public.teams LOOP
    PERFORM public.seed_role_permissions(t.id);
  END LOOP;
END $$;

-- Update create_team to seed permissions
CREATE OR REPLACE FUNCTION public.create_team(_name text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE _team UUID; _uid UUID := auth.uid(); _code TEXT;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  _code := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
  INSERT INTO public.teams (name, invite_code, owner_id) VALUES (_name, _code, _uid) RETURNING id INTO _team;
  INSERT INTO public.team_members(team_id, user_id, role) VALUES (_team, _uid, 'owner');
  INSERT INTO public.storage_units(team_id, name) VALUES (_team, 'Unit 1'), (_team, 'Unit 2');
  UPDATE public.profiles SET current_team_id = _team WHERE id = _uid;
  PERFORM public.seed_role_permissions(_team);
  RETURN _team;
END $$;

-- ============================================================
-- DELETE permission for chairs (gated by has_permission)
-- ============================================================
DROP POLICY IF EXISTS chairs_team_all ON public.chairs;
CREATE POLICY chairs_select ON public.chairs FOR SELECT USING (public.is_team_member(team_id, auth.uid()));
CREATE POLICY chairs_insert ON public.chairs FOR INSERT WITH CHECK (public.is_team_member(team_id, auth.uid()));
CREATE POLICY chairs_update ON public.chairs FOR UPDATE USING (public.is_team_member(team_id, auth.uid())) WITH CHECK (public.is_team_member(team_id, auth.uid()));
CREATE POLICY chairs_delete ON public.chairs FOR DELETE USING (public.has_permission(team_id, auth.uid(), 'chair.delete'));

-- ============================================================
-- Team invites table (replaces single invite_code on teams)
-- ============================================================
CREATE TABLE public.team_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  code TEXT NOT NULL UNIQUE,
  role public.team_role NOT NULL DEFAULT 'staff',
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  used_count INT NOT NULL DEFAULT 0
);

ALTER TABLE public.team_invites ENABLE ROW LEVEL SECURITY;

-- Anyone authed can read by code (needed for join screen lookup)
CREATE POLICY ti_read_any_authed ON public.team_invites FOR SELECT TO authenticated USING (true);
CREATE POLICY ti_owner_manage ON public.team_invites FOR ALL
  USING (public.has_permission(team_id, auth.uid(), 'team.invite'))
  WITH CHECK (public.has_permission(team_id, auth.uid(), 'team.invite'));

CREATE OR REPLACE FUNCTION public.create_team_invite(_team_id UUID, _role public.team_role)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _uid UUID := auth.uid(); _code TEXT;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.has_permission(_team_id, _uid, 'team.invite') THEN
    RAISE EXCEPTION 'No permission to invite';
  END IF;
  IF _role = 'owner' THEN RAISE EXCEPTION 'Cannot invite as owner'; END IF;
  _code := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
  INSERT INTO public.team_invites(team_id, code, role, created_by)
    VALUES (_team_id, _code, _role, _uid);
  RETURN _code;
END $$;

-- Update join_team_by_code to use team_invites first, fall back to legacy code
CREATE OR REPLACE FUNCTION public.join_team_by_code(_code TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _team UUID; _role public.team_role := 'staff'; _uid UUID := auth.uid(); _invite_id UUID;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT id, team_id, role INTO _invite_id, _team, _role FROM public.team_invites WHERE code = upper(_code);
  IF _team IS NULL THEN
    SELECT id INTO _team FROM public.teams WHERE invite_code = upper(_code);
    _role := 'staff';
  END IF;
  IF _team IS NULL THEN RAISE EXCEPTION 'Invalid invite code'; END IF;
  INSERT INTO public.team_members(team_id, user_id, role) VALUES (_team, _uid, _role)
    ON CONFLICT (team_id, user_id) DO UPDATE SET role = EXCLUDED.role;
  IF _invite_id IS NOT NULL THEN
    UPDATE public.team_invites SET used_count = used_count + 1 WHERE id = _invite_id;
  END IF;
  UPDATE public.profiles SET current_team_id = _team WHERE id = _uid;
  RETURN _team;
END $$;

-- Lookup invite role (for join screen preview)
CREATE OR REPLACE FUNCTION public.lookup_invite(_code TEXT)
RETURNS TABLE(team_name TEXT, role public.team_role)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT t.name, COALESCE(ti.role, 'staff'::public.team_role)
  FROM public.teams t
  LEFT JOIN public.team_invites ti ON ti.team_id = t.id AND ti.code = upper(_code)
  WHERE t.invite_code = upper(_code) OR ti.code = upper(_code)
  LIMIT 1;
$$;

-- ============================================================
-- Chat messages: read receipts + realtime
-- ============================================================
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS read_by UUID[] NOT NULL DEFAULT '{}';
ALTER TABLE public.chat_messages REPLICA IDENTITY FULL;
ALTER TABLE public.member_locations REPLICA IDENTITY FULL;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.member_locations;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;