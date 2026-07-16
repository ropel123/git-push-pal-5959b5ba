
CREATE TABLE public.reclassify_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status text NOT NULL DEFAULT 'running',
  total integer NOT NULL DEFAULT 0,
  processed integer NOT NULL DEFAULT 0,
  classified integer NOT NULL DEFAULT 0,
  errors jsonb NOT NULL DEFAULT '[]'::jsonb,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.reclassify_jobs TO authenticated;
GRANT ALL ON public.reclassify_jobs TO service_role;

ALTER TABLE public.reclassify_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view reclassify jobs"
  ON public.reclassify_jobs FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_reclassify_jobs_updated_at
  BEFORE UPDATE ON public.reclassify_jobs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
