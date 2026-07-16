
CREATE EXTENSION IF NOT EXISTS unaccent;

CREATE OR REPLACE FUNCTION public.sourcing_norm(_txt text)
RETURNS text
LANGUAGE sql IMMUTABLE
SET search_path = public, extensions
AS $$
  WITH base AS (
    SELECT lower(coalesce(public.unaccent(_txt), '')) AS t
  ),
  cleaned AS (
    SELECT regexp_replace(
      regexp_replace(
        regexp_replace(t,
          '\m(communaute de communes|communaute d agglomeration|communaute urbaine|metropole de|cc de|ca de|cu de|syndicat mixte de|syndicat intercommunal de|mairie de|ville de|commune de|conseil departemental de|conseil regional de|departement de|region de|etablissement public de|sas|sarl|sa|eurl|sci|epic|spl|smpa|sem)\M',
          ' ', 'gi'),
        '[[:punct:]]+', ' ', 'g'),
      '\s+', ' ', 'g') AS t
    FROM base
  )
  SELECT trim(t) FROM cleaned;
$$;

GRANT EXECUTE ON FUNCTION public.sourcing_norm(text) TO authenticated, service_role, anon;

DROP VIEW IF EXISTS public.v_tender_sources CASCADE;

CREATE VIEW public.v_tender_sources AS
SELECT
  t.id,
  t.reference,
  t.title,
  t.object,
  t.buyer_name,
  t.deadline,
  t.publication_date,
  t.source AS raw_source,
  CASE
    WHEN upper(coalesce(t.source, '')) = 'BOAMP' THEN 'BOAMP'
    WHEN upper(coalesce(t.source, '')) = 'TED'   THEN 'TED'
    ELSE 'Scraping'
  END AS source_category,
  lower(coalesce(t.source, 'unknown')) AS source_key,
  md5(
    coalesce(left(public.sourcing_norm(t.buyer_name), 120), '') || '|' ||
    coalesce(left(public.sourcing_norm(coalesce(t.object, t.title)), 150), '') || '|' ||
    coalesce(to_char(date_trunc('day', t.deadline), 'YYYY-MM-DD'), '')
  ) AS dedup_key
FROM public.tenders t
WHERE coalesce(t.buyer_name, t.object, t.title) IS NOT NULL;

GRANT SELECT ON public.v_tender_sources TO authenticated, service_role;
