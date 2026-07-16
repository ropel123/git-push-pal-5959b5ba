ALTER TABLE public.award_notices
  ADD COLUMN IF NOT EXISTS award_criteria jsonb,
  ADD COLUMN IF NOT EXISTS offers_received int,
  ADD COLUMN IF NOT EXISTS offers_admitted int,
  ADD COLUMN IF NOT EXISTS offers_rejected int,
  ADD COLUMN IF NOT EXISTS subcontracting_share numeric,
  ADD COLUMN IF NOT EXISTS winner_address text,
  ADD COLUMN IF NOT EXISTS winner_legal_form text,
  ADD COLUMN IF NOT EXISTS winner_country text,
  ADD COLUMN IF NOT EXISTS notification_date date,
  ADD COLUMN IF NOT EXISTS cpv_codes text[],
  ADD COLUMN IF NOT EXISTS place_of_performance text,
  ADD COLUMN IF NOT EXISTS notice_url text;

CREATE INDEX IF NOT EXISTS award_notices_winner_siren_idx ON public.award_notices (winner_siren);
CREATE INDEX IF NOT EXISTS award_notices_source_idx ON public.award_notices (source);