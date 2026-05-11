
-- Trips: add OSRM-estimated distance for variance check
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS estimated_km numeric;

-- Chairs: store estimated trip distance from OSRM
ALTER TABLE public.chairs ADD COLUMN IF NOT EXISTS trip_estimated_km numeric;

-- Vehicle expense categories
DO $$ BEGIN
  CREATE TYPE public.vehicle_expense_category AS ENUM (
    'gas','insurance','oil_change','tires','registration','repairs','parking','car_wash','lease','other'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.vehicle_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL,
  created_by uuid NOT NULL,
  expense_date date NOT NULL DEFAULT CURRENT_DATE,
  category public.vehicle_expense_category NOT NULL DEFAULT 'gas',
  amount numeric NOT NULL,
  vendor text,
  odometer_km numeric,
  notes text,
  receipt_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.vehicle_expenses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS vehicle_expenses_team_all ON public.vehicle_expenses;
CREATE POLICY vehicle_expenses_team_all ON public.vehicle_expenses
  FOR ALL USING (public.is_team_member(team_id, auth.uid()))
  WITH CHECK (public.is_team_member(team_id, auth.uid()));

-- Annual odometer snapshots: one row per team per year
CREATE TABLE IF NOT EXISTS public.odometer_readings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL,
  created_by uuid NOT NULL,
  year int NOT NULL,
  start_km numeric,
  end_km numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (team_id, year)
);

ALTER TABLE public.odometer_readings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS odometer_team_all ON public.odometer_readings;
CREATE POLICY odometer_team_all ON public.odometer_readings
  FOR ALL USING (public.is_team_member(team_id, auth.uid()))
  WITH CHECK (public.is_team_member(team_id, auth.uid()));

DROP TRIGGER IF EXISTS trg_odometer_touch ON public.odometer_readings;
CREATE TRIGGER trg_odometer_touch BEFORE UPDATE ON public.odometer_readings
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
