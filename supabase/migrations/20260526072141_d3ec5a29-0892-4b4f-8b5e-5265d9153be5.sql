CREATE TABLE IF NOT EXISTS public.platform_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform text NOT NULL UNIQUE,
  cookies jsonb NOT NULL DEFAULT '{}'::jsonb,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '12 hours'),
  last_used_at timestamptz,
  login_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.platform_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage platform_sessions"
ON public.platform_sessions
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_platform_sessions_updated_at
BEFORE UPDATE ON public.platform_sessions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();