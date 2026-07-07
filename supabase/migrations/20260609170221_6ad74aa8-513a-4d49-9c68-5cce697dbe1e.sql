CREATE OR REPLACE FUNCTION public.get_platform_coverage(
  _filter text DEFAULT 'all',
  _search text DEFAULT NULL,
  _limit integer DEFAULT 500,
  _offset integer DEFAULT 0,
  _category text DEFAULT NULL
)
RETURNS TABLE(host text, category text, boamp_count bigint, ted_count bigint, total_count bigint, is_scraped boolean, scraped_urls bigint, sample_dce_url text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
  )
  SELECT a.host, public.platform_category(a.host) AS category,
    a.boamp_count, a.ted_count, a.total_count,
    (s.n IS NOT NULL AND s.n > 0) AS is_scraped,
    coalesce(s.n, 0) AS scraped_urls, a.sample_dce_url
  FROM agg a
  LEFT JOIN scraped s ON s.host = a.host
  WHERE
    (_filter = 'all'
      OR (_filter = 'covered' AND s.n IS NOT NULL AND s.n > 0)
      OR (_filter = 'missing' AND (s.n IS NULL OR s.n = 0)))
    AND (_search IS NULL OR _search = '' OR a.host ILIKE '%'||_search||'%')
    AND (_category IS NULL OR _category = '' OR _category = 'all'
         OR public.platform_category(a.host) = _category)
  ORDER BY a.total_count DESC
  LIMIT greatest(_limit, 1) OFFSET greatest(_offset, 0);
$function$;