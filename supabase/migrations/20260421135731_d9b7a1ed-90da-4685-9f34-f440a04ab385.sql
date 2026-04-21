-- 1. Table sourcing_urls : la liste des URLs à scraper
CREATE TABLE public.sourcing_urls (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  url TEXT NOT NULL UNIQUE,
  platform TEXT NOT NULL DEFAULT 'custom',
  display_name TEXT,
  frequency_hours INTEGER NOT NULL DEFAULT 6,
  is_active BOOLEAN NOT NULL DEFAULT true,
  parser_type TEXT NOT NULL DEFAULT 'auto',
  selectors JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_run_at TIMESTAMPTZ,
  last_status TEXT,
  last_items_found INTEGER DEFAULT 0,
  last_items_inserted INTEGER DEFAULT 0,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.sourcing_urls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage sourcing_urls"
  ON public.sourcing_urls FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_sourcing_urls_updated_at
  BEFORE UPDATE ON public.sourcing_urls
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_sourcing_urls_active_due
  ON public.sourcing_urls(is_active, last_run_at);

-- 2. Table ingest_cursors : reprise sur incident
CREATE TABLE public.ingest_cursors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sourcing_url_id UUID REFERENCES public.sourcing_urls(id) ON DELETE CASCADE,
  source_key TEXT NOT NULL,
  last_run_at TIMESTAMPTZ,
  last_publication_date DATE,
  last_offset INTEGER DEFAULT 0,
  last_status TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(source_key)
);

ALTER TABLE public.ingest_cursors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage ingest_cursors"
  ON public.ingest_cursors FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_ingest_cursors_updated_at
  BEFORE UPDATE ON public.ingest_cursors
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Enrichir scrape_logs
ALTER TABLE public.scrape_logs
  ADD COLUMN IF NOT EXISTS items_updated INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS items_skipped INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS sourcing_url_id UUID REFERENCES public.sourcing_urls(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_scrape_logs_sourcing_url
  ON public.scrape_logs(sourcing_url_id, started_at DESC);

-- 4. Dédup tenders sur (source, reference) avant index unique
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY COALESCE(source, 'manual'), COALESCE(NULLIF(reference, ''), id::text)
           ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST
         ) AS rn
  FROM public.tenders
)
DELETE FROM public.tenders
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- 5. Index unique pour idempotence garantie
CREATE UNIQUE INDEX IF NOT EXISTS uniq_tenders_source_reference
  ON public.tenders(source, reference)
  WHERE reference IS NOT NULL AND reference <> '';