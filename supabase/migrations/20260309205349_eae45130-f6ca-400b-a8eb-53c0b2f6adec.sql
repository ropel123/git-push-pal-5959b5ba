ALTER TABLE public.tenders
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS buyer_address text,
  ADD COLUMN IF NOT EXISTS buyer_contact jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS execution_location text,
  ADD COLUMN IF NOT EXISTS nuts_code text,
  ADD COLUMN IF NOT EXISTS contract_type text,
  ADD COLUMN IF NOT EXISTS award_criteria text,
  ADD COLUMN IF NOT EXISTS participation_conditions text,
  ADD COLUMN IF NOT EXISTS additional_info text;