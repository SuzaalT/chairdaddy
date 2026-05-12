-- ============================================================
-- 1. Expand team_role enum with new role values
-- ============================================================
ALTER TYPE public.team_role ADD VALUE IF NOT EXISTS 'co_owner';
ALTER TYPE public.team_role ADD VALUE IF NOT EXISTS 'partner';
ALTER TYPE public.team_role ADD VALUE IF NOT EXISTS 'staff';
ALTER TYPE public.team_role ADD VALUE IF NOT EXISTS 'viewer';