
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS is_personal boolean NOT NULL DEFAULT false;
