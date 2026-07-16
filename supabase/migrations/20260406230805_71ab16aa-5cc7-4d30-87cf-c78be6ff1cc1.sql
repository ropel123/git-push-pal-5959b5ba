
-- Add branding columns to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS company_logo_path text,
  ADD COLUMN IF NOT EXISTS company_description text,
  ADD COLUMN IF NOT EXISTS company_website text,
  ADD COLUMN IF NOT EXISTS primary_color text DEFAULT '#F97316',
  ADD COLUMN IF NOT EXISTS secondary_color text DEFAULT '#1E293B',
  ADD COLUMN IF NOT EXISTS company_references jsonb DEFAULT '[]'::jsonb;

-- Create company-assets bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('company-assets', 'company-assets', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for company-assets
CREATE POLICY "Users can view own company assets"
ON storage.objects FOR SELECT
USING (bucket_id = 'company-assets' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can upload own company assets"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'company-assets' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update own company assets"
ON storage.objects FOR UPDATE
USING (bucket_id = 'company-assets' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete own company assets"
ON storage.objects FOR DELETE
USING (bucket_id = 'company-assets' AND auth.uid()::text = (storage.foldername(name))[1]);
