-- Fonction utilitaire pour updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Table des comptes "robots" par plateforme
CREATE TABLE public.platform_robots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform TEXT NOT NULL UNIQUE,
  login TEXT NOT NULL,
  password_encrypted TEXT NOT NULL,
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  last_used_at TIMESTAMPTZ,
  success_count INTEGER DEFAULT 0,
  failure_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.platform_robots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage robots"
ON public.platform_robots FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Table des playbooks
CREATE TABLE public.agent_playbooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  url_pattern TEXT NOT NULL,
  requires_auth BOOLEAN DEFAULT false,
  requires_captcha BOOLEAN DEFAULT false,
  steps JSONB NOT NULL DEFAULT '[]'::jsonb,
  success_rate NUMERIC DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.agent_playbooks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage playbooks"
ON public.agent_playbooks FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated read playbooks"
ON public.agent_playbooks FOR SELECT
TO authenticated
USING (true);

-- Table des runs
CREATE TABLE public.agent_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tender_id UUID,
  platform TEXT NOT NULL,
  dce_url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  started_at TIMESTAMPTZ DEFAULT now(),
  finished_at TIMESTAMPTZ,
  duration_ms INTEGER,
  cost_usd NUMERIC DEFAULT 0,
  captchas_solved INTEGER DEFAULT 0,
  files_downloaded INTEGER DEFAULT 0,
  browserbase_session_id TEXT,
  error_message TEXT,
  trace JSONB DEFAULT '[]'::jsonb,
  triggered_by UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.agent_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read runs"
ON public.agent_runs FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins manage runs"
ON public.agent_runs FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_agent_runs_tender ON public.agent_runs(tender_id);
CREATE INDEX idx_agent_runs_status ON public.agent_runs(status);
CREATE INDEX idx_agent_runs_created ON public.agent_runs(created_at DESC);

-- Triggers updated_at
CREATE TRIGGER update_platform_robots_updated_at
BEFORE UPDATE ON public.platform_robots
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_agent_playbooks_updated_at
BEFORE UPDATE ON public.agent_playbooks
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed playbooks Phase 1 (Atexo)
INSERT INTO public.agent_playbooks (platform, display_name, url_pattern, requires_auth, requires_captcha, steps) VALUES
('atexo_achatpublic', 'AchatPublic (Atexo)', 'achatpublic\.com', true, true, '[
  {"action": "navigate", "target": "{{dce_url}}"},
  {"action": "click_if_present", "natural": "Accepter les cookies"},
  {"action": "click", "natural": "Consulter le dossier ou Télécharger le DCE"},
  {"action": "fill_login", "use_robot": true},
  {"action": "solve_captcha_if_present"},
  {"action": "click", "natural": "Télécharger tout le DCE en un fichier ZIP"},
  {"action": "wait_download", "timeout_ms": 60000}
]'::jsonb),
('atexo_localtrust', 'Local Trust (Atexo)', 'local-trust\.com', true, true, '[
  {"action": "navigate", "target": "{{dce_url}}"},
  {"action": "click_if_present", "natural": "Accepter les cookies"},
  {"action": "click", "natural": "Télécharger le DCE"},
  {"action": "fill_login", "use_robot": true},
  {"action": "solve_captcha_if_present"},
  {"action": "click", "natural": "Confirmer le téléchargement"},
  {"action": "wait_download", "timeout_ms": 60000}
]'::jsonb);