
-- 1. Supprimer les enregistrements liés aux AO BOAMP/TED
DELETE FROM public.pipeline_comments
WHERE pipeline_item_id IN (
  SELECT id FROM public.pipeline_items
  WHERE tender_id IN (SELECT id FROM public.tenders WHERE source IN ('boamp', 'ted'))
);

DELETE FROM public.pipeline_items
WHERE tender_id IN (SELECT id FROM public.tenders WHERE source IN ('boamp', 'ted'));

DELETE FROM public.dce_downloads
WHERE tender_id IN (SELECT id FROM public.tenders WHERE source IN ('boamp', 'ted'));

DELETE FROM public.dce_uploads
WHERE tender_id IN (SELECT id FROM public.tenders WHERE source IN ('boamp', 'ted'));

DELETE FROM public.tender_analyses
WHERE tender_id IN (SELECT id FROM public.tenders WHERE source IN ('boamp', 'ted'));

DELETE FROM public.agent_runs
WHERE tender_id IN (SELECT id FROM public.tenders WHERE source IN ('boamp', 'ted'));

DELETE FROM public.award_notices
WHERE tender_id IN (SELECT id FROM public.tenders WHERE source IN ('boamp', 'ted'));

-- 2. Supprimer les AO eux-mêmes
DELETE FROM public.tenders WHERE source IN ('boamp', 'ted');

-- 3. Nettoyer les logs et curseurs liés au sourcing BOAMP/TED
DELETE FROM public.scrape_logs
WHERE source ILIKE 'boamp%' OR source ILIKE 'ted%';

DELETE FROM public.ingest_cursors
WHERE source_key ILIKE 'boamp%' OR source_key ILIKE 'ted%';

-- 4. Désactiver toute URL de sourcing pointant vers BOAMP ou TED
UPDATE public.sourcing_urls
SET is_active = false,
    last_error = 'Source désactivée : BOAMP/TED retirés de la stratégie data',
    updated_at = now()
WHERE url ILIKE '%boamp.fr%'
   OR url ILIKE '%ted.europa.eu%'
   OR platform IN ('boamp', 'ted');
