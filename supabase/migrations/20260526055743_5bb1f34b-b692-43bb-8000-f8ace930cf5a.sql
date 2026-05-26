CREATE OR REPLACE FUNCTION public.get_distinct_listing_hosts(_source text)
RETURNS TABLE(host text, count bigint)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    split_part(regexp_replace(enriched_data->'raw'->>'_source_url', '^https?://', ''), '/', 1) AS host,
    count(*)::bigint AS count
  FROM public.tenders
  WHERE source = _source
    AND enriched_data->'raw'->>'_source_url' IS NOT NULL
    AND enriched_data->'raw'->>'_source_url' <> ''
  GROUP BY 1
  HAVING split_part(regexp_replace(enriched_data->'raw'->>'_source_url', '^https?://', ''), '/', 1) <> ''
  ORDER BY 2 DESC
$$;