ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS company_certifications text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS company_skills text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS company_team text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS company_equipment text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS company_past_work text DEFAULT NULL;