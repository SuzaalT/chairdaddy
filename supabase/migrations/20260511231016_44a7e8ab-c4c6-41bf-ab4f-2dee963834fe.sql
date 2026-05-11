DROP POLICY IF EXISTS "profiles_self_select" ON public.profiles;
CREATE POLICY "profiles_self_select" ON public.profiles FOR SELECT
USING (auth.uid() = id OR public.is_team_member(public.current_user_team(), id));