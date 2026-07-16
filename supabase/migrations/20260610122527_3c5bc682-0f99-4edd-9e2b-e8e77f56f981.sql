
-- 1. Drop dependent views first
DROP VIEW IF EXISTS public.v_tender_sources CASCADE;
DROP TABLE IF EXISTS public.v_tender_matches CASCADE;

-- 2. Drop SQL functions tied to list scraping
DROP FUNCTION IF EXISTS public.get_sourcing_kpis() CASCADE;
DROP FUNCTION IF EXISTS public.get_sourcing_coverage(text, integer, integer, text) CASCADE;
DROP FUNCTION IF EXISTS public.get_sourcing_per_source() CASCADE;
DROP FUNCTION IF EXISTS public.get_sourcing_dedup_details(text) CASCADE;
DROP FUNCTION IF EXISTS public.get_distinct_listing_hosts(text) CASCADE;
DROP FUNCTION IF EXISTS public.match_batch(text, text) CASCADE;
DROP FUNCTION IF EXISTS public.refresh_tender_matching() CASCADE;
DROP FUNCTION IF EXISTS public.rebuild_tender_groups() CASCADE;
DROP FUNCTION IF EXISTS public.get_platform_coverage_kpis() CASCADE;
DROP FUNCTION IF EXISTS public.sourcing_norm(text) CASCADE;

-- 3. Clean agent_playbooks rows tied to list scraping (keep DCE-agent playbooks: those rows have platform + url_pattern + steps, no sourcing_url_id)
DELETE FROM public.agent_playbooks WHERE sourcing_url_id IS NOT NULL;
ALTER TABLE public.agent_playbooks DROP COLUMN IF EXISTS sourcing_url_id;
ALTER TABLE public.agent_playbooks DROP COLUMN IF EXISTS list_strategy;
ALTER TABLE public.agent_playbooks DROP COLUMN IF EXISTS pagination_hint;
ALTER TABLE public.agent_playbooks DROP COLUMN IF EXISTS confidence;
ALTER TABLE public.agent_playbooks DROP COLUMN IF EXISTS fail_count;
ALTER TABLE public.agent_playbooks DROP COLUMN IF EXISTS last_error_type;
ALTER TABLE public.agent_playbooks DROP COLUMN IF EXISTS last_validated_at;

-- 4. Drop tables (CASCADE to handle FKs)
DROP TABLE IF EXISTS public.sourcing_urls CASCADE;
DROP TABLE IF EXISTS public.sourcing_seen_urls CASCADE;
DROP TABLE IF EXISTS public.scrape_logs CASCADE;
DROP TABLE IF EXISTS public.platform_robots CASCADE;
DROP TABLE IF EXISTS public.platform_sessions CASCADE;
DROP TABLE IF EXISTS public.rescrape_jobs CASCADE;
DROP TABLE IF EXISTS public.agent_anonymous_identity CASCADE;
DROP TABLE IF EXISTS public.tender_groups CASCADE;
