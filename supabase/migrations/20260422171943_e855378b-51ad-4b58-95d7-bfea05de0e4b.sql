CREATE TABLE public.platform_fingerprints (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  host TEXT NOT NULL UNIQUE,
  platform TEXT NOT NULL,
  confidence NUMERIC NOT NULL DEFAULT 0,
  evidence JSONB NOT NULL DEFAULT '[]'::jsonb,
  detected_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_platform_fingerprints_host ON public.platform_fingerprints(host);
CREATE INDEX idx_platform_fingerprints_platform ON public.platform_fingerprints(platform);

ALTER TABLE public.platform_fingerprints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read fingerprints"
ON public.platform_fingerprints
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins manage fingerprints"
ON public.platform_fingerprints
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_platform_fingerprints_updated_at
BEFORE UPDATE ON public.platform_fingerprints
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();