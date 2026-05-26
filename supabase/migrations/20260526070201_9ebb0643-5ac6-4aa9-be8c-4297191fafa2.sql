-- Nettoyage des fiches MPI orphelines : créées par le scraping pré-correction
-- (template strategy), elles n'ont ni source_url ni dce_url. Les nouvelles
-- versions ont été re-créées avec hybrid + IDS depuis le markdown.
DELETE FROM public.tenders
WHERE source = 'scrape:mpi'
  AND source_url IS NULL
  AND dce_url IS NULL
  AND enriched_data->'raw'->>'_source_url' ~* 'fuseaction=(marchesP\.rechM|pub\.affResultats)';