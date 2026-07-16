-- Mapping plateforme détectée par l'agent IA → catégorie dashboard
CREATE OR REPLACE FUNCTION public.platform_ts_to_category(_p text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $$
  SELECT CASE _p
    WHEN 'atexo' THEN 'atexo'
    WHEN 'aura' THEN 'atexo'
    WHEN 'ternum' THEN 'atexo'
    WHEN 'maximilien' THEN 'atexo'
    WHEN 'megalis' THEN 'atexo'
    WHEN 'mpi' THEN 'mpi'
    WHEN 'place' THEN 'place'
    WHEN 'achatpublic' THEN 'achatpublic'
    WHEN 'e-marchespublics' THEN 'dematis'
    WHEN 'dematis' THEN 'dematis'
    WHEN 'marches-securises' THEN 'marches-securises'
    WHEN 'klekoon' THEN 'klekoon'
    WHEN 'xmarches' THEN 'xmarches'
    WHEN 'safetender' THEN 'safetender'
    WHEN 'omnikles' THEN 'safetender'
    WHEN 'synapse' THEN 'synapse'
    WHEN 'centrale-marches' THEN 'centrale-marches'
    WHEN 'francemarches' THEN 'francemarches'
    WHEN 'aji' THEN 'aji'
    WHEN 'eu-supply' THEN 'eu-supply'
    WHEN 'domino' THEN 'domino'
    WHEN 'bravo' THEN 'bravo'
    WHEN 'custom' THEN NULL
    WHEN '' THEN NULL
    WHEN NULL THEN NULL
    ELSE _p
  END
$$;

GRANT EXECUTE ON FUNCTION public.platform_ts_to_category(text) TO anon, authenticated, service_role;

-- get_platform_coverage : lit platform_fingerprints en priorité
CREATE OR REPLACE FUNCTION public.get_platform_coverage(
  _filter text DEFAULT 'all',
  _search text DEFAULT NULL,
  _limit integer DEFAULT 500,
  _offset integer DEFAULT 0,
  _category text DEFAULT NULL
)
RETURNS TABLE(
  host text,
  category text,
  boamp_count bigint,
  ted_count bigint,
  total_count bigint,
  is_scraped boolean,
  scraped_urls bigint,
  sample_dce_url text
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH tender_hosts AS (
    SELECT public.platform_host_norm(dce_url) AS host, source, dce_url
    FROM public.tenders
    WHERE source IN ('BOAMP','TED') AND dce_url IS NOT NULL AND dce_url <> ''
  ),
  agg AS (
    SELECT host,
      count(*) FILTER (WHERE source = 'BOAMP') AS boamp_count,
      count(*) FILTER (WHERE source = 'TED')   AS ted_count,
      count(*) AS total_count,
      (array_agg(dce_url ORDER BY length(dce_url)))[1] AS sample_dce_url
    FROM tender_hosts WHERE host IS NOT NULL GROUP BY host
  ),
  scraped AS (
    SELECT public.platform_host_norm(url) AS host, count(*)::bigint AS n
    FROM public.sourcing_urls WHERE url IS NOT NULL GROUP BY 1
  ),
  resolved AS (
    SELECT a.host,
      COALESCE(
        public.platform_ts_to_category(pf.platform),
        public.platform_category(a.host)
      ) AS category,
      a.boamp_count, a.ted_count, a.total_count, a.sample_dce_url,
      s.n AS scraped_n
    FROM agg a
    LEFT JOIN public.platform_fingerprints pf ON pf.host = a.host
    LEFT JOIN scraped s ON s.host = a.host
  )
  SELECT r.host, r.category,
    r.boamp_count, r.ted_count, r.total_count,
    (r.scraped_n IS NOT NULL AND r.scraped_n > 0) AS is_scraped,
    COALESCE(r.scraped_n, 0) AS scraped_urls,
    r.sample_dce_url
  FROM resolved r
  WHERE
    (_filter = 'all'
      OR (_filter = 'covered' AND r.scraped_n IS NOT NULL AND r.scraped_n > 0)
      OR (_filter = 'missing' AND (r.scraped_n IS NULL OR r.scraped_n = 0)))
    AND (_search IS NULL OR _search = '' OR r.host ILIKE '%'||_search||'%')
    AND (_category IS NULL OR _category = '' OR _category = 'all'
         OR r.category = _category)
  ORDER BY r.total_count DESC
  LIMIT greatest(_limit, 1) OFFSET greatest(_offset, 0);
$$;

-- get_platform_coverage_kpis : idem
CREATE OR REPLACE FUNCTION public.get_platform_coverage_kpis()
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH tender_hosts AS (
    SELECT DISTINCT public.platform_host_norm(dce_url) AS host
    FROM public.tenders
    WHERE source IN ('BOAMP','TED') AND dce_url IS NOT NULL AND dce_url <> ''
  ),
  scraped AS (
    SELECT DISTINCT public.platform_host_norm(url) AS host
    FROM public.sourcing_urls WHERE url IS NOT NULL
  ),
  merged AS (
    SELECT t.host,
      (s.host IS NOT NULL) AS covered,
      COALESCE(
        public.platform_ts_to_category(pf.platform),
        public.platform_category(t.host)
      ) AS category
    FROM tender_hosts t
    LEFT JOIN scraped s ON s.host = t.host
    LEFT JOIN public.platform_fingerprints pf ON pf.host = t.host
    WHERE t.host IS NOT NULL
  )
  SELECT jsonb_build_object(
    'total_hosts',   (SELECT count(*) FROM merged),
    'covered_hosts', (SELECT count(*) FROM merged WHERE covered),
    'missing_hosts', (SELECT count(*) FROM merged WHERE NOT covered),
    'coverage_pct',  CASE WHEN (SELECT count(*) FROM merged) = 0 THEN 0
                          ELSE round(100.0 * (SELECT count(*) FROM merged WHERE covered)
                                            / (SELECT count(*) FROM merged), 1) END,
    'by_category',   (
      SELECT jsonb_object_agg(category, jsonb_build_object('total', total, 'covered', covered))
      FROM (
        SELECT m.category, count(*) AS total, count(*) FILTER (WHERE m.covered) AS covered
        FROM merged m GROUP BY 1
      ) c
    )
  );
$$;