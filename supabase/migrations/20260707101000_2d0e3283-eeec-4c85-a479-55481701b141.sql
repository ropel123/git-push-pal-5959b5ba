-- Journal des appels aux fonctions IA, utilisé pour le rate limiting par utilisateur.
-- Accès service_role uniquement (RLS activée sans policy pour les clients).
-- Idempotent : sûr à ré-appliquer.

CREATE TABLE IF NOT EXISTS public.ai_request_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  fn TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT ALL ON public.ai_request_log TO service_role;

ALTER TABLE public.ai_request_log ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_ai_request_log_user ON public.ai_request_log(user_id, fn, created_at DESC);
