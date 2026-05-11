
-- ===== ENUMS =====
CREATE TYPE public.team_role AS ENUM ('owner','member');
CREATE TYPE public.chair_status AS ENUM ('in_stock','listed','sold');
CREATE TYPE public.chair_source AS ENUM ('fb_marketplace','kijiji','supplier','estate_sale','other');
CREATE TYPE public.expense_category AS ENUM ('vehicle_fuel','helper_wages','refurb_supplies','cleaning_supplies','tools_equipment','storage_rent','phone_internet','insurance','bank_fees','other');

-- ===== TEAMS =====
CREATE TABLE public.teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  invite_code TEXT NOT NULL UNIQUE,
  owner_id UUID NOT NULL,
  brand_prefix TEXT NOT NULL DEFAULT 'CF',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ===== TEAM MEMBERS (roles) =====
CREATE TABLE public.team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role public.team_role NOT NULL DEFAULT 'member',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(team_id, user_id)
);

-- ===== PROFILES =====
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY,
  full_name TEXT,
  email TEXT,
  notification_email TEXT,
  anthropic_key TEXT,
  current_team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ===== STORAGE UNITS =====
CREATE TABLE public.storage_units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ===== CHAIRS =====
CREATE TABLE public.chairs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  created_by UUID NOT NULL,
  sku TEXT NOT NULL,
  brand TEXT NOT NULL,
  model TEXT,
  source public.chair_source NOT NULL DEFAULT 'fb_marketplace',
  date_acquired DATE NOT NULL DEFAULT CURRENT_DATE,
  storage_unit TEXT,
  condition TEXT,
  defects TEXT,
  status public.chair_status NOT NULL DEFAULT 'in_stock',
  list_price NUMERIC(10,2),
  date_listed DATE,
  sold_price NUMERIC(10,2),
  date_sold DATE,
  notes TEXT,
  -- costs
  purchase_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  helper_cost NUMERIC(10,2) NOT NULL DEFAULT 0,
  refurb_cost NUMERIC(10,2) NOT NULL DEFAULT 0,
  transport_cost NUMERIC(10,2) NOT NULL DEFAULT 0,
  work_done TEXT,
  -- mileage
  trip_start TEXT,
  trip_end TEXT,
  trip_km NUMERIC(10,2),
  trip_round_trip BOOLEAN DEFAULT false,
  -- proof
  proof_purchase_url TEXT,
  receipt_urls TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(team_id, sku)
);

-- ===== EXPENSES =====
CREATE TABLE public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  created_by UUID NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  category public.expense_category NOT NULL DEFAULT 'other',
  vendor TEXT,
  notes TEXT,
  receipt_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ===== TRIPS =====
CREATE TABLE public.trips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  created_by UUID NOT NULL,
  trip_date DATE NOT NULL DEFAULT CURRENT_DATE,
  start_location TEXT NOT NULL,
  end_location TEXT NOT NULL,
  km NUMERIC(10,2) NOT NULL,
  round_trip BOOLEAN NOT NULL DEFAULT false,
  purpose TEXT,
  chair_id UUID REFERENCES public.chairs(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ===== CHAT =====
CREATE TABLE public.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  content TEXT,
  image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ===== LOCATIONS =====
CREATE TABLE public.member_locations (
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  lat NUMERIC(10,6),
  lng NUMERIC(10,6),
  sharing BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (team_id, user_id)
);

-- ===== Helper function: is user member of team =====
CREATE OR REPLACE FUNCTION public.is_team_member(_team_id UUID, _user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS(SELECT 1 FROM public.team_members WHERE team_id=_team_id AND user_id=_user_id);
$$;

CREATE OR REPLACE FUNCTION public.current_user_team()
RETURNS UUID
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT current_team_id FROM public.profiles WHERE id = auth.uid() $$;

-- ===== ENABLE RLS =====
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.storage_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chairs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_locations ENABLE ROW LEVEL SECURITY;

-- ===== POLICIES =====
-- profiles: user owns own profile
CREATE POLICY "profiles_self_select" ON public.profiles FOR SELECT USING (auth.uid() = id OR public.is_team_member((SELECT current_team_id FROM public.profiles WHERE id=auth.uid()), id));
CREATE POLICY "profiles_self_insert" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_self_update" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- teams: members can read; anyone authed can read by invite code (handled via RPC); owner can update; insert open to authed
CREATE POLICY "teams_member_select" ON public.teams FOR SELECT USING (public.is_team_member(id, auth.uid()));
CREATE POLICY "teams_insert" ON public.teams FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "teams_owner_update" ON public.teams FOR UPDATE USING (auth.uid() = owner_id);

-- team_members: members can see other members; users can insert themselves
CREATE POLICY "tm_select_team" ON public.team_members FOR SELECT USING (public.is_team_member(team_id, auth.uid()));
CREATE POLICY "tm_insert_self" ON public.team_members FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "tm_delete_self" ON public.team_members FOR DELETE USING (auth.uid() = user_id);

-- storage_units, chairs, expenses, trips, chat_messages, member_locations: team-scoped CRUD
DO $$ DECLARE t TEXT; BEGIN
  FOR t IN SELECT unnest(ARRAY['storage_units','chairs','expenses','trips','chat_messages','member_locations']) LOOP
    EXECUTE format('CREATE POLICY "%1$s_team_all" ON public.%1$s FOR ALL USING (public.is_team_member(team_id, auth.uid())) WITH CHECK (public.is_team_member(team_id, auth.uid()));', t);
  END LOOP;
END $$;

-- ===== Triggers =====
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, notification_email)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1)), NEW.email);
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.touch_updated_at() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE TRIGGER chairs_touch BEFORE UPDATE ON public.chairs FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER profiles_touch BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ===== RPC: join team by invite code =====
CREATE OR REPLACE FUNCTION public.join_team_by_code(_code TEXT)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _team UUID; _uid UUID := auth.uid();
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT id INTO _team FROM public.teams WHERE invite_code = upper(_code);
  IF _team IS NULL THEN RAISE EXCEPTION 'Invalid invite code'; END IF;
  INSERT INTO public.team_members(team_id, user_id, role) VALUES (_team, _uid, 'member')
    ON CONFLICT (team_id, user_id) DO NOTHING;
  UPDATE public.profiles SET current_team_id = _team WHERE id = _uid;
  RETURN _team;
END $$;

-- ===== RPC: create team =====
CREATE OR REPLACE FUNCTION public.create_team(_name TEXT)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _team UUID; _uid UUID := auth.uid(); _code TEXT;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  _code := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
  INSERT INTO public.teams (name, invite_code, owner_id) VALUES (_name, _code, _uid) RETURNING id INTO _team;
  INSERT INTO public.team_members(team_id, user_id, role) VALUES (_team, _uid, 'owner');
  INSERT INTO public.storage_units(team_id, name) VALUES (_team, 'Unit 1'), (_team, 'Unit 2');
  UPDATE public.profiles SET current_team_id = _team WHERE id = _uid;
  RETURN _team;
END $$;

-- ===== Realtime =====
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.member_locations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chairs;

-- ===== Storage buckets =====
INSERT INTO storage.buckets (id, name, public) VALUES
  ('chair-photos','chair-photos', true),
  ('receipts','receipts', true),
  ('chat-photos','chat-photos', true),
  ('proof-docs','proof-docs', false)
ON CONFLICT (id) DO NOTHING;

-- Public read for the public buckets
CREATE POLICY "public_read_chair_photos" ON storage.objects FOR SELECT USING (bucket_id = 'chair-photos');
CREATE POLICY "public_read_receipts" ON storage.objects FOR SELECT USING (bucket_id = 'receipts');
CREATE POLICY "public_read_chat_photos" ON storage.objects FOR SELECT USING (bucket_id = 'chat-photos');

-- Authenticated users can upload (path validation handled in app)
CREATE POLICY "authed_upload_chair_photos" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id='chair-photos');
CREATE POLICY "authed_upload_receipts" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id='receipts');
CREATE POLICY "authed_upload_chat_photos" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id='chat-photos');
CREATE POLICY "authed_upload_proof" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id='proof-docs');
CREATE POLICY "authed_read_proof" ON storage.objects FOR SELECT TO authenticated USING (bucket_id='proof-docs');
