-- Étendre agent_playbooks pour le système Scout/Healer
ALTER TABLE public.agent_playbooks
  ADD COLUMN IF NOT EXISTS sourcing_url_id uuid REFERENCES public.sourcing_urls(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS confidence numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pagination_hint text,
  ADD COLUMN IF NOT EXISTS last_validated_at timestamptz,
  ADD COLUMN IF NOT EXISTS fail_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_error_type text,
  ADD COLUMN IF NOT EXISTS scout_model text,
  ADD COLUMN IF NOT EXISTS scout_tokens_used integer,
  ADD COLUMN IF NOT EXISTS evidence text,
  ADD COLUMN IF NOT EXISTS list_strategy text;

CREATE INDEX IF NOT EXISTS idx_agent_playbooks_sourcing_active
  ON public.agent_playbooks (sourcing_url_id, is_active);

CREATE UNIQUE INDEX IF NOT EXISTS idx_agent_playbooks_sourcing_version
  ON public.agent_playbooks (sourcing_url_id, version)
  WHERE sourcing_url_id IS NOT NULL;

-- Cache anti-doublon des URLs de consultation déjà vues
CREATE TABLE IF NOT EXISTS public.sourcing_seen_urls (
  sourcing_url_id uuid NOT NULL REFERENCES public.sourcing_urls(id) ON DELETE CASCADE,
  url_hash text NOT NULL,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (sourcing_url_id, url_hash)
);

CREATE INDEX IF NOT EXISTS idx_sourcing_seen_urls_lastseen
  ON public.sourcing_seen_urls (sourcing_url_id, last_seen_at);

ALTER TABLE public.sourcing_seen_urls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage sourcing_seen_urls"
  ON public.sourcing_seen_urls
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));