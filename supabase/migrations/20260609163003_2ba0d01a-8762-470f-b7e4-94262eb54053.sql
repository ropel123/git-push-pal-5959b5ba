CREATE OR REPLACE FUNCTION public.platform_host_norm(_url text)
RETURNS text
LANGUAGE sql IMMUTABLE
SET search_path TO 'public'
AS $$
  SELECT NULLIF(
    regexp_replace(
      regexp_replace(
        lower(coalesce(_url, '')),
        '^https?://', '', 'i'),
      '^www\.|[/?#].*$', '', 'g'),
    '')
$$;

CREATE OR REPLACE FUNCTION public.platform_category(_host text)
RETURNS text
LANGUAGE sql IMMUTABLE
SET search_path TO 'public'
AS $$
  SELECT CASE
    WHEN _host IS NULL OR _host = '' THEN 'inconnu'
    WHEN _host LIKE '%e-marchespublics.com' OR _host LIKE '%emarchespublics.com' THEN 'atexo'
    WHEN _host LIKE '%marches-publics.info' OR _host LIKE '%mpiaws%' THEN 'mpi'
    WHEN _host LIKE '%marches-publics.gouv.fr' OR _host = 'place.marches-publics.gouv.fr' THEN 'place'
    WHEN _host LIKE '%achatpublic.com' THEN 'achatpublic'
    WHEN _host LIKE '%marches-securises.fr' THEN 'marches-securises'
    WHEN _host LIKE '%maximilien.fr' THEN 'maximilien'
    WHEN _host LIKE '%klekoon.com' THEN 'klekoon'
    WHEN _host LIKE '%safetender.com' OR _host LIKE '%omnikles%' THEN 'safetender'
    WHEN _host LIKE '%aws-france.com' OR _host LIKE '%aws-entreprises.com' THEN 'aws'
    WHEN _host LIKE '%xmarches.fr' THEN 'xmarches'
    WHEN _host LIKE '%anjoumarchespublics.fr' THEN 'anjou'
    WHEN _host LIKE '%alsacemarchespublics.eu' OR _host LIKE '%demat-ampa%' THEN 'atexo'
    WHEN _host LIKE '%.marchespublics.%' OR _host LIKE 'marchespublics.%' THEN 'autre-mp'
    ELSE 'autre'
  END
$$;

CREATE OR REPLACE FUNCTION public.get_platform_coverage(
  _filter text DEFAULT 'all',
  _search text DEFAULT NULL,
  _limit  int  DEFAULT 500,
  _offset int  DEFAULT 0
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
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH tender_hosts AS (
    SELECT
      public.platform_host_norm(dce_url) AS host,
      source,
      dce_url
    FROM public.tenders
    WHERE source IN ('BOAMP','TED')
      AND dce_url IS NOT NULL
      AND dce_url <> ''
  ),
  agg AS (
    SELECT
      host,
      count(*) FILTER (WHERE source = 'BOAMP') AS boamp_count,
      count(*) FILTER (WHERE source = 'TED')   AS ted_count,
      count(*)                                  AS total_count,
      (array_agg(dce_url ORDER BY length(dce_url)))[1] AS sample_dce_url
    FROM tender_hosts
    WHERE host IS NOT NULL
    GROUP BY host
  ),
  scraped AS (
    SELECT public.platform_host_norm(url) AS host, count(*)::bigint AS n
    FROM public.sourcing_urls
    WHERE url IS NOT NULL
    GROUP BY 1
  )
  SELECT
    a.host,
    public.platform_category(a.host) AS category,
    a.boamp_count,
    a.ted_count,
    a.total_count,
    (s.n IS NOT NULL AND s.n > 0) AS is_scraped,
    coalesce(s.n, 0) AS scraped_urls,
    a.sample_dce_url
  FROM agg a
  LEFT JOIN scraped s ON s.host = a.host
  WHERE
    (_filter = 'all'
      OR (_filter = 'covered' AND s.n IS NOT NULL AND s.n > 0)
      OR (_filter = 'missing' AND (s.n IS NULL OR s.n = 0)))
    AND (_search IS NULL OR _search = ''
         OR a.host ILIKE '%'||_search||'%')
  ORDER BY a.total_count DESC
  LIMIT greatest(_limit, 1) OFFSET greatest(_offset, 0);
$$;

CREATE OR REPLACE FUNCTION public.get_platform_coverage_kpis()
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH tender_hosts AS (
    SELECT DISTINCT public.platform_host_norm(dce_url) AS host
    FROM public.tenders
    WHERE source IN ('BOAMP','TED')
      AND dce_url IS NOT NULL AND dce_url <> ''
  ),
  scraped AS (
    SELECT DISTINCT public.platform_host_norm(url) AS host
    FROM public.sourcing_urls WHERE url IS NOT NULL
  ),
  merged AS (
    SELECT t.host, (s.host IS NOT NULL) AS covered
    FROM tender_hosts t
    LEFT JOIN scraped s ON s.host = t.host
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
        SELECT public.platform_category(m.host) AS category,
               count(*) AS total,
               count(*) FILTER (WHERE m.covered) AS covered
        FROM merged m GROUP BY 1
      ) c
    )
  );
$$;

GRANT EXECUTE ON FUNCTION public.platform_host_norm(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.platform_category(text)  TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_platform_coverage(text, text, int, int) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_platform_coverage_kpis() TO authenticated, service_role;