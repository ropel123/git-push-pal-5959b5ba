
INSERT INTO storage.buckets (id, name, public) VALUES ('dce-documents', 'dce-documents', false);

CREATE POLICY "Users can upload own DCE files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'dce-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view own DCE files"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'dce-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete own DCE files"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'dce-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE TABLE public.dce_uploads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tender_id uuid REFERENCES public.tenders(id) ON DELETE CASCADE NOT NULL,
  user_id uuid NOT NULL,
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_size bigint,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.dce_uploads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own uploads"
ON public.dce_uploads FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can insert own uploads"
ON public.dce_uploads FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own uploads"
ON public.dce_uploads FOR DELETE TO authenticated
USING (user_id = auth.uid());

CREATE TABLE public.tender_analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tender_id uuid REFERENCES public.tenders(id) ON DELETE CASCADE NOT NULL,
  user_id uuid NOT NULL,
  analysis_type text NOT NULL,
  result text,
  model_used text,
  tokens_used integer,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.tender_analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own analyses"
ON public.tender_analyses FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can create own analyses"
ON public.tender_analyses FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());
