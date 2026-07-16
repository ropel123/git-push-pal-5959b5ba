
CREATE OR REPLACE FUNCTION public.get_sourcing_kpis()
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH grouped AS (
    SELECT dedup_key,
      bool_or(source_category = 'BOAMP') AS has_boamp,
      bool_or(source_category = 'Scraping') AS has_scrape,
      bool_or(source_category = 'TED') AS has_ted
    FROM public.v_tender_sources GROUP BY dedup_key
  )
  SELECT jsonb_build_object(
    'total_tenders', (SELECT count(*) FROM public.tenders),
    'total_unique', (SELECT count(*) FROM grouped),
    'ted_only',                 (SELECT count(*) FROM grouped WHERE has_ted AND NOT has_boamp AND NOT has_scrape),
    'boamp_only',               (SELECT count(*) FROM grouped WHERE has_boamp AND NOT has_ted AND NOT has_scrape),
    'ted_and_boamp',            (SELECT count(*) FROM grouped WHERE has_ted AND has_boamp AND NOT has_scrape),
    'scrape_and_boamp',         (SELECT count(*) FROM grouped WHERE has_scrape AND has_boamp AND NOT has_ted),
    'scrape_and_ted',           (SELECT count(*) FROM grouped WHERE has_scrape AND has_ted AND NOT has_boamp),
    'scrape_and_ted_and_boamp', (SELECT count(*) FROM grouped WHERE has_scrape AND has_ted AND has_boamp),
    'scrape_only',              (SELECT count(*) FROM grouped WHERE has_scrape AND NOT has_boamp AND NOT has_ted),
    'with_boamp',  (SELECT count(*) FROM grouped WHERE has_boamp),
    'with_scrape', (SELECT count(*) FROM grouped WHERE has_scrape),
    'with_ted',    (SELECT count(*) FROM grouped WHERE has_ted)
  );
$$;

CREATE OR REPLACE FUNCTION public.get_sourcing_coverage(
  _filter text DEFAULT 'all',
  _limit int DEFAULT 50,
  _offset int DEFAULT 0,
  _search text DEFAULT NULL
)
RETURNS TABLE(
  dedup_key text, title text, buyer_name text,
  deadline timestamptz, reference text,
  sources text[], source_keys text[], ids uuid[]
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH grouped AS (
    SELECT v.dedup_key,
      (array_agg(v.title ORDER BY v.publication_date DESC NULLS LAST))[1] AS title,
      (array_agg(v.buyer_name ORDER BY v.publication_date DESC NULLS LAST))[1] AS buyer_name,
      max(v.deadline) AS deadline,
      (array_agg(v.reference ORDER BY (v.reference IS NULL)))[1] AS reference,
      array_agg(DISTINCT v.source_category) AS sources,
      array_agg(DISTINCT v.source_key) AS source_keys,
      array_agg(v.id) AS ids,
      bool_or(v.source_category = 'BOAMP') AS has_boamp,
      bool_or(v.source_category = 'Scraping') AS has_scrape,
      bool_or(v.source_category = 'TED') AS has_ted
    FROM public.v_tender_sources v GROUP BY v.dedup_key
  )
  SELECT g.dedup_key, g.title, g.buyer_name, g.deadline, g.reference, g.sources, g.source_keys, g.ids
  FROM grouped g
  WHERE CASE _filter
    WHEN 'ted_only'                 THEN g.has_ted AND NOT g.has_boamp AND NOT g.has_scrape
    WHEN 'boamp_only'               THEN g.has_boamp AND NOT g.has_ted AND NOT g.has_scrape
    WHEN 'ted_and_boamp'            THEN g.has_ted AND g.has_boamp AND NOT g.has_scrape
    WHEN 'scrape_and_boamp'         THEN g.has_scrape AND g.has_boamp AND NOT g.has_ted
    WHEN 'scrape_and_ted'           THEN g.has_scrape AND g.has_ted AND NOT g.has_boamp
    WHEN 'scrape_and_ted_and_boamp' THEN g.has_scrape AND g.has_ted AND g.has_boamp
    WHEN 'scrape_only'              THEN g.has_scrape AND NOT g.has_boamp AND NOT g.has_ted
    ELSE true
  END
  AND (_search IS NULL OR _search = ''
       OR g.title ilike '%'||_search||'%'
       OR g.buyer_name ilike '%'||_search||'%'
       OR g.reference ilike '%'||_search||'%')
  ORDER BY g.deadline DESC NULLS LAST
  LIMIT greatest(_limit, 1) OFFSET greatest(_offset, 0);
$$;

CREATE OR REPLACE FUNCTION public.get_sourcing_dedup_details(_dedup_key text)
RETURNS TABLE(
  id uuid,
  source_category text,
  source_key text,
  raw_source text,
  reference text,
  publication_date date,
  source_url text,
  platform_display text,
  sourcing_url text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    t.id,
    v.source_category,
    v.source_key,
    v.raw_source,
    v.reference,
    v.publication_date,
    t.source_url,
    su.display_name AS platform_display,
    su.url AS sourcing_url
  FROM public.v_tender_sources v
  JOIN public.tenders t ON t.id = v.id
  LEFT JOIN public.sourcing_urls su
    ON lower(su.platform) = lower(v.source_key)
  WHERE v.dedup_key = _dedup_key
  ORDER BY v.publication_date DESC NULLS LAST;
$$;

GRANT EXECUTE ON FUNCTION public.get_sourcing_dedup_details(text) TO authenticated, service_role;
