
-- Table to track automatic DCE download attempts
CREATE TABLE public.dce_downloads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tender_id uuid NOT NULL,
  user_id uuid NOT NULL,
  platform text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  error_message text,
  file_path text,
  enriched_data jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.dce_downloads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own downloads"
  ON public.dce_downloads FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can create own downloads"
  ON public.dce_downloads FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own downloads"
  ON public.dce_downloads FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own downloads"
  ON public.dce_downloads FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Add enriched_data column to tenders
ALTER TABLE public.tenders ADD COLUMN IF NOT EXISTS enriched_data jsonb DEFAULT '{}'::jsonb;
