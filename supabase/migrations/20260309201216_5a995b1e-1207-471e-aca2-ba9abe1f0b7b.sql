
-- Add source_url column to tenders
ALTER TABLE public.tenders ADD COLUMN IF NOT EXISTS source_url text;

-- Create unique index for deduplication (reference + source)
CREATE UNIQUE INDEX IF NOT EXISTS idx_tenders_reference_source ON public.tenders (reference, source) WHERE reference IS NOT NULL AND source IS NOT NULL;

-- Index on publication_date for incremental queries
CREATE INDEX IF NOT EXISTS idx_tenders_publication_date ON public.tenders (publication_date);

-- Create scrape_logs table
CREATE TABLE IF NOT EXISTS public.scrape_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  items_found integer DEFAULT 0,
  items_inserted integer DEFAULT 0,
  errors text,
  status text NOT NULL DEFAULT 'running'
);

ALTER TABLE public.scrape_logs ENABLE ROW LEVEL SECURITY;

-- Only admins can read scrape_logs
CREATE POLICY "Admins can read scrape_logs"
  ON public.scrape_logs
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Service role can insert (edge functions use service role)
-- No INSERT/UPDATE policy needed since edge functions use service_role key
