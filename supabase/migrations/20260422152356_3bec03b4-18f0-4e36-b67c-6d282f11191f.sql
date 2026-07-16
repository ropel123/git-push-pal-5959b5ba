-- Reclassify platform labels in sourcing_urls, tenders.source, scrape_logs.source
-- using robust hostname-based signatures.

-- Helper CTE-based update for sourcing_urls
UPDATE public.sourcing_urls
SET platform = CASE
  WHEN url ~* '://marchespublics\.auvergnerhonealpes\.eu(/|$)' THEN 'aura'
  WHEN url ~* '://([^/]+\.)?maximilien\.fr(/|$)' THEN 'maximilien'
  WHEN url ~* '://([^/]+\.)?megalis\.bretagne\.bzh(/|$)' THEN 'megalis'
  WHEN url ~* '://([^/]+\.)?ternum-bfc\.fr(/|$)' THEN 'ternum'
  WHEN url ~* '://([^/]+\.)?alsacemarchespublics\.eu(/|$)' THEN 'atexo'
  WHEN url ~* '://([^/]+\.)?(ampmetropole\.fr|nantesmetropole\.fr|paysdelaloire\.fr|grand-nancy\.org|grandlyon\.com|aquitaine\.fr|lorraine\.eu|demat-ampa\.fr|marches-publics-hopitaux\.fr)(/|$)' THEN 'atexo'
  WHEN url ~* '://[^/]*atexo[^/]*(/|$)' THEN 'atexo'
  WHEN url ~* '://([^/]+\.)?marches-publics\.info(/|$)' THEN 'mpi'
  WHEN url ~* '://([^/]+\.)?marchespublics\.grandest\.fr(/|$)' THEN 'mpi'
  WHEN url ~* '://([^/]+\.)?projets-achats\.marches-publics\.gouv\.fr(/|$)' THEN 'place'
  WHEN url ~* '://(www\.)?marches-publics\.gouv\.fr(/|$)' THEN 'place'
  WHEN url ~* '://([^/]+\.)?achatpublic\.com(/|$)' THEN 'achatpublic'
  WHEN url ~* '://([^/]+\.)?e-marchespublics\.com(/|$)' THEN 'e-marchespublics'
  WHEN url ~* '://([^/]+\.)?marches-securises\.fr(/|$)' THEN 'marches-securises'
  WHEN url ~* '://([^/]+\.)?klekoon\.com(/|$)' THEN 'klekoon'
  WHEN url ~* '://([^/]+\.)?xmarches\.fr(/|$)' THEN 'xmarches'
  WHEN url ~* '://[^/]*safetender[^/]*(/|$)' THEN 'safetender'
  WHEN url ~* '/sdm/' THEN 'atexo'
  ELSE 'custom'
END;

-- Reclassify tenders.source (only when prefixed by "scrape:")
UPDATE public.tenders t
SET source = 'scrape:' || (
  CASE
    WHEN t.source_url ~* '://marchespublics\.auvergnerhonealpes\.eu(/|$)' THEN 'aura'
    WHEN t.source_url ~* '://([^/]+\.)?maximilien\.fr(/|$)' THEN 'maximilien'
    WHEN t.source_url ~* '://([^/]+\.)?megalis\.bretagne\.bzh(/|$)' THEN 'megalis'
    WHEN t.source_url ~* '://([^/]+\.)?ternum-bfc\.fr(/|$)' THEN 'ternum'
    WHEN t.source_url ~* '://([^/]+\.)?alsacemarchespublics\.eu(/|$)' THEN 'atexo'
    WHEN t.source_url ~* '://([^/]+\.)?(ampmetropole\.fr|nantesmetropole\.fr|paysdelaloire\.fr|grand-nancy\.org|grandlyon\.com|aquitaine\.fr|lorraine\.eu|demat-ampa\.fr|marches-publics-hopitaux\.fr)(/|$)' THEN 'atexo'
    WHEN t.source_url ~* '://[^/]*atexo[^/]*(/|$)' THEN 'atexo'
    WHEN t.source_url ~* '://([^/]+\.)?marches-publics\.info(/|$)' THEN 'mpi'
    WHEN t.source_url ~* '://([^/]+\.)?marchespublics\.grandest\.fr(/|$)' THEN 'mpi'
    WHEN t.source_url ~* '://([^/]+\.)?projets-achats\.marches-publics\.gouv\.fr(/|$)' THEN 'place'
    WHEN t.source_url ~* '://(www\.)?marches-publics\.gouv\.fr(/|$)' THEN 'place'
    WHEN t.source_url ~* '://([^/]+\.)?achatpublic\.com(/|$)' THEN 'achatpublic'
    WHEN t.source_url ~* '://([^/]+\.)?e-marchespublics\.com(/|$)' THEN 'e-marchespublics'
    WHEN t.source_url ~* '://([^/]+\.)?marches-securises\.fr(/|$)' THEN 'marches-securises'
    WHEN t.source_url ~* '://([^/]+\.)?klekoon\.com(/|$)' THEN 'klekoon'
    WHEN t.source_url ~* '://([^/]+\.)?xmarches\.fr(/|$)' THEN 'xmarches'
    WHEN t.source_url ~* '://[^/]*safetender[^/]*(/|$)' THEN 'safetender'
    WHEN t.source_url ~* '/sdm/' THEN 'atexo'
    ELSE 'custom'
  END
)
WHERE t.source LIKE 'scrape:%' AND t.source_url IS NOT NULL AND t.source_url <> '';

-- Reclassify scrape_logs.source via sourcing_url_id join (authoritative)
UPDATE public.scrape_logs sl
SET source = 'scrape:' || su.platform
FROM public.sourcing_urls su
WHERE sl.sourcing_url_id = su.id
  AND sl.source LIKE 'scrape:%';
