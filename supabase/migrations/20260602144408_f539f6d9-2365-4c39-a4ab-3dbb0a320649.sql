-- 1. sourcing_urls: kind column
ALTER TABLE public.sourcing_urls
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'tender'
    CHECK (kind IN ('tender','award'));
CREATE INDEX IF NOT EXISTS idx_sourcing_urls_kind ON public.sourcing_urls(kind);

-- 2. award_notices: extend for standalone scraping
ALTER TABLE public.award_notices
  ADD COLUMN IF NOT EXISTS buyer_name text,
  ADD COLUMN IF NOT EXISTS buyer_siret text,
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS reference text,
  ADD COLUMN IF NOT EXISTS source text,
  ADD COLUMN IF NOT EXISTS source_url text,
  ADD COLUMN IF NOT EXISTS sourcing_url_id uuid,
  ADD COLUMN IF NOT EXISTS raw jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_award_notices_sourcing_url_id ON public.award_notices(sourcing_url_id);
CREATE INDEX IF NOT EXISTS idx_award_notices_reference ON public.award_notices(reference);
CREATE INDEX IF NOT EXISTS idx_award_notices_buyer_siret ON public.award_notices(buyer_siret);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_award_notices_source_url ON public.award_notices(source_url) WHERE source_url IS NOT NULL;

-- 3. Grants (service_role writes from edge functions, authenticated reads)
GRANT SELECT ON public.award_notices TO authenticated;
GRANT ALL ON public.award_notices TO service_role;
GRANT ALL ON public.sourcing_urls TO service_role;

-- 4. Updated_at trigger on award_notices
DROP TRIGGER IF EXISTS update_award_notices_updated_at ON public.award_notices;
CREATE TRIGGER update_award_notices_updated_at
BEFORE UPDATE ON public.award_notices
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();