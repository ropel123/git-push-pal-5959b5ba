
CREATE OR REPLACE FUNCTION public.get_dce_sourcing_by_fingerprint(
  _search text DEFAULT NULL,
  _category text DEFAULT NULL
)
RETURNS TABLE(
  host text,
  platform text,
  category text,
  fingerprint_source text,
  confidence numeric,
  boamp_count bigint,
  ted_count bigint,
  total_count bigint,
  sample_tender_id uuid,
  sample_dce_url text
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH tender_hosts AS (
    SELECT
      id,
      source,
      dce_url,
      public.platform_host_norm(dce_url) AS host
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
      count(*) AS total_count,
      (array_agg(id ORDER BY id))[1] AS sample_tender_id,
      (array_agg(dce_url ORDER BY length(dce_url)))[1] AS sample_dce_url
    FROM tender_hosts
    WHERE host IS NOT NULL AND host <> ''
    GROUP BY host
  ),
  joined AS (
    SELECT
      a.host,
      pf.platform,
      COALESCE(
        public.platform_ts_to_category(pf.platform),
        public.platform_category(a.host)
      ) AS category,
      CASE
        WHEN pf.platform IS NULL THEN NULL
        WHEN EXISTS (
          SELECT 1 FROM jsonb_array_elements_text(COALESCE(pf.evidence,'[]'::jsonb)) e
          WHERE e LIKE 'ai:%'
        ) THEN 'ai'
        WHEN EXISTS (
          SELECT 1 FROM jsonb_array_elements_text(COALESCE(pf.evidence,'[]'::jsonb)) e
          WHERE e LIKE 'hostname:%'
        ) THEN 'hostname'
        ELSE 'other'
      END AS fingerprint_source,
      pf.confidence,
      a.boamp_count, a.ted_count, a.total_count,
      a.sample_tender_id, a.sample_dce_url
    FROM agg a
    LEFT JOIN public.platform_fingerprints pf ON pf.host = a.host
  )
  SELECT *
  FROM joined j
  WHERE (_search IS NULL OR _search = '' OR j.host ILIKE '%'||_search||'%')
    AND (
      _category IS NULL OR _category = '' OR _category = 'all'
      OR (_category = 'inconnu' AND (j.category IS NULL OR j.category = 'inconnu' OR j.category = 'autre'))
      OR j.category = _category
    )
  ORDER BY j.total_count DESC;
$$;

REVOKE ALL ON FUNCTION public.get_dce_sourcing_by_fingerprint(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_dce_sourcing_by_fingerprint(text, text) TO authenticated, service_role;
