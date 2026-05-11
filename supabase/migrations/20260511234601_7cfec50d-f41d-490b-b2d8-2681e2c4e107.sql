
ALTER TABLE public.vehicle_expenses
  ADD COLUMN IF NOT EXISTS litres numeric,
  ADD COLUMN IF NOT EXISTS price_per_litre numeric,
  ADD COLUMN IF NOT EXISTS station text;
