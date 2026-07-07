
-- =========================================================
-- 1. sourcing_urls
-- =========================================================
CREATE TABLE public.sourcing_urls (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  url TEXT NOT NULL UNIQUE,
  platform TEXT NOT NULL DEFAULT 'custom',
  display_name TEXT,
  frequency_hours INTEGER NOT NULL DEFAULT 6,
  is_active BOOLEAN NOT NULL DEFAULT true,
  parser_type TEXT NOT NULL DEFAULT 'auto',
  selectors JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_run_at TIMESTAMPTZ,
  last_status TEXT,
  last_items_found INTEGER DEFAULT 0,
  last_items_inserted INTEGER DEFAULT 0,
  last_error TEXT,
  kind TEXT NOT NULL DEFAULT 'tender' CHECK (kind IN ('tender','award')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT ALL ON public.sourcing_urls TO service_role;
GRANT SELECT ON public.sourcing_urls TO authenticated;

ALTER TABLE public.sourcing_urls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage sourcing_urls"
  ON public.sourcing_urls FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_sourcing_urls_updated_at
  BEFORE UPDATE ON public.sourcing_urls
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_sourcing_urls_active_due ON public.sourcing_urls(is_active, last_run_at);
CREATE INDEX idx_sourcing_urls_kind ON public.sourcing_urls(kind);

-- =========================================================
-- 2. sourcing_seen_urls (anti-doublon)
-- =========================================================
CREATE TABLE public.sourcing_seen_urls (
  sourcing_url_id UUID NOT NULL REFERENCES public.sourcing_urls(id) ON DELETE CASCADE,
  url_hash TEXT NOT NULL,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (sourcing_url_id, url_hash)
);

GRANT ALL ON public.sourcing_seen_urls TO service_role;

ALTER TABLE public.sourcing_seen_urls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage sourcing_seen_urls"
  ON public.sourcing_seen_urls FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_sourcing_seen_urls_lastseen ON public.sourcing_seen_urls (sourcing_url_id, last_seen_at);

-- =========================================================
-- 3. scrape_logs
-- =========================================================
CREATE TABLE public.scrape_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source TEXT NOT NULL,
  sourcing_url_id UUID REFERENCES public.sourcing_urls(id) ON DELETE SET NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  status TEXT,
  items_found INTEGER DEFAULT 0,
  items_inserted INTEGER DEFAULT 0,
  items_updated INTEGER DEFAULT 0,
  items_skipped INTEGER DEFAULT 0,
  error TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

GRANT ALL ON public.scrape_logs TO service_role;
GRANT SELECT ON public.scrape_logs TO authenticated;

ALTER TABLE public.scrape_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read scrape_logs"
  ON public.scrape_logs FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_scrape_logs_sourcing_url ON public.scrape_logs(sourcing_url_id, started_at DESC);

-- =========================================================
-- 4. Recontraindre FK vers sourcing_urls
-- =========================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='agent_playbooks' AND column_name='sourcing_url_id') THEN
    BEGIN
      ALTER TABLE public.agent_playbooks
        ADD CONSTRAINT agent_playbooks_sourcing_url_id_fkey
        FOREIGN KEY (sourcing_url_id) REFERENCES public.sourcing_urls(id) ON DELETE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='award_notices' AND column_name='sourcing_url_id') THEN
    BEGIN
      ALTER TABLE public.award_notices
        ADD CONSTRAINT award_notices_sourcing_url_id_fkey
        FOREIGN KEY (sourcing_url_id) REFERENCES public.sourcing_urls(id) ON DELETE SET NULL;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END IF;
END $$;

-- =========================================================
-- 5. ai_prompts + ai_prompt_versions
-- =========================================================
CREATE TABLE public.ai_prompts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  description TEXT,
  provider TEXT NOT NULL DEFAULT 'openrouter',
  model TEXT NOT NULL,
  fallback_provider TEXT,
  fallback_model TEXT,
  temperature NUMERIC,
  system_prompt TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  version INTEGER NOT NULL DEFAULT 1,
  updated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.ai_prompt_versions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  prompt_id UUID NOT NULL REFERENCES public.ai_prompts(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  fallback_provider TEXT,
  fallback_model TEXT,
  temperature NUMERIC,
  system_prompt TEXT NOT NULL,
  note TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_prompts TO authenticated;
GRANT SELECT, INSERT ON public.ai_prompt_versions TO authenticated;
GRANT ALL ON public.ai_prompts TO service_role;
GRANT ALL ON public.ai_prompt_versions TO service_role;

ALTER TABLE public.ai_prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_prompt_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read prompts" ON public.ai_prompts
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins insert prompts" ON public.ai_prompts
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins update prompts" ON public.ai_prompts
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins delete prompts" ON public.ai_prompts
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins read prompt versions" ON public.ai_prompt_versions
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins insert prompt versions" ON public.ai_prompt_versions
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_ai_prompt_versions_prompt ON public.ai_prompt_versions(prompt_id, version DESC);

CREATE TRIGGER update_ai_prompts_updated_at
  BEFORE UPDATE ON public.ai_prompts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- 6. ai_request_log
-- =========================================================
CREATE TABLE public.ai_request_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  fn TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT ALL ON public.ai_request_log TO service_role;

ALTER TABLE public.ai_request_log ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_ai_request_log_user ON public.ai_request_log(user_id, fn, created_at DESC);

-- =========================================================
-- 7. memoir_conversations
-- =========================================================
CREATE TABLE public.memoir_conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mode TEXT NOT NULL DEFAULT 'onboarding' CHECK (mode IN ('onboarding', 'dialog')),
  messages JSONB NOT NULL DEFAULT '[]'::jsonb,
  memoir_draft JSONB,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'abandoned')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.memoir_conversations TO authenticated;
GRANT ALL ON public.memoir_conversations TO service_role;

ALTER TABLE public.memoir_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own memoir conversations" ON public.memoir_conversations
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own memoir conversations" ON public.memoir_conversations
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own memoir conversations" ON public.memoir_conversations
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own memoir conversations" ON public.memoir_conversations
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX idx_memoir_conversations_user ON public.memoir_conversations(user_id, status);
CREATE UNIQUE INDEX idx_memoir_conversations_active
  ON public.memoir_conversations(user_id, mode)
  WHERE status = 'active';

CREATE TRIGGER update_memoir_conversations_updated_at
  BEFORE UPDATE ON public.memoir_conversations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- 8. Seed sourcing_urls : 10 plateformes + BOAMP
-- =========================================================
INSERT INTO public.sourcing_urls (url, display_name, platform, frequency_hours, is_active, parser_type, kind) VALUES
('https://marches.maximilien.fr/?page=entreprise.EntrepriseAdvancedSearch&AllCons', 'Maximilien (Île-de-France)', 'maximilien', 6, true, 'auto', 'tender'),
('https://projets-achats.marches-publics.gouv.fr/', 'APProch — Préavis (État)', 'place', 12, true, 'auto', 'tender'),
('https://marches.ternum-bfc.fr/?page=entreprise.EntrepriseAdvancedSearch&AllCons', 'Ternum (Bourgogne-Franche-Comté)', 'ternum', 6, true, 'auto', 'tender'),
('https://marchespublics.grandest.fr/avis/index.cfm?fuseaction=mpAW.rechM', 'Région Grand Est', 'mpi', 6, true, 'auto', 'tender'),
('https://plateforme.alsacemarchespublics.eu/?page=Entreprise.EntrepriseAdvancedSearch&searchAnnCons&keyWord=&categorie=0&localisations=', 'Alsace Marchés Publics', 'atexo', 6, true, 'auto', 'tender'),
('https://marchespublics.ampmetropole.fr/?page=Entreprise.EntrepriseAdvancedSearch&AllCons', 'Aix-Marseille Provence Métropole', 'atexo', 6, true, 'auto', 'tender'),
('https://marchespublics.nantesmetropole.fr/?page=Entreprise.EntrepriseAdvancedSearch&AllCons', 'Nantes Métropole', 'atexo', 6, true, 'auto', 'tender'),
('https://marchespublics.auvergnerhonealpes.eu/sdm/ent2/gen/rechercheCsl.action?tp=1776784247743', 'Région Auvergne-Rhône-Alpes', 'aura', 6, true, 'auto', 'tender'),
('https://marchespublics.paysdelaloire.fr/?page=Entreprise.EntrepriseAdvancedSearch&AllCons', 'Région Pays de la Loire', 'atexo', 6, true, 'auto', 'tender'),
('https://haute-garonne.marches-publics.info/avis/index.cfm?fuseaction=mpAW.rechM&IDs=4150', 'Haute-Garonne', 'mpi', 6, true, 'auto', 'tender'),
('https://www.boamp.fr/api/explore/v2.1/catalog/datasets/boamp', 'BOAMP (API opendata)', 'boamp', 6, true, 'api', 'tender')
ON CONFLICT (url) DO NOTHING;
