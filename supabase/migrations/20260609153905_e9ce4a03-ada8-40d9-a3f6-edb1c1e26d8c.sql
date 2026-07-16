
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

CREATE OR REPLACE FUNCTION public.match_norm(_txt text)
RETURNS text LANGUAGE sql IMMUTABLE
SET search_path = public, extensions
AS $$
  SELECT trim(regexp_replace(
    regexp_replace(
      lower(coalesce(public.unaccent(_txt), '')),
      '[[:punct:]]+', ' ', 'g'),
    '\s+', ' ', 'g'))
$$;
GRANT EXECUTE ON FUNCTION public.match_norm(text) TO authenticated, anon, service_role;

DROP INDEX IF EXISTS public.idx_tenders_title_trgm;
DROP INDEX IF EXISTS public.idx_tenders_buyer_trgm;
CREATE INDEX idx_tenders_title_trgm
  ON public.tenders USING gin (public.match_norm(title) gin_trgm_ops);
CREATE INDEX idx_tenders_buyer_trgm
  ON public.tenders USING gin (public.match_norm(buyer_name) gin_trgm_ops);

DROP MATERIALIZED VIEW IF EXISTS public.v_tender_matches CASCADE;
CREATE MATERIALIZED VIEW public.v_tender_matches AS
WITH norm AS (
  SELECT id,
    public.match_norm(title) AS title_n,
    public.match_norm(buyer_name) AS buyer_n,
    deadline,
    CASE
      WHEN upper(coalesce(source, '')) = 'BOAMP' THEN 'BOAMP'
      WHEN upper(coalesce(source, '')) = 'TED'   THEN 'TED'
      ELSE 'Scraping'
    END AS cat
  FROM public.tenders
  WHERE title IS NOT NULL AND buyer_name IS NOT NULL
    AND length(public.match_norm(title)) > 8
    AND length(public.match_norm(buyer_name)) > 3
)
SELECT a.id AS id_a, b.id AS id_b, a.cat AS cat_a, b.cat AS cat_b,
  similarity(a.title_n, b.title_n) AS title_sim,
  similarity(a.buyer_n, b.buyer_n) AS buyer_sim
FROM norm a JOIN norm b
  ON b.id > a.id AND a.cat <> b.cat
 AND a.title_n % b.title_n AND a.buyer_n % b.buyer_n
WHERE similarity(a.title_n, b.title_n) > 0.85
  AND similarity(a.buyer_n, b.buyer_n) > 0.55
  AND (a.deadline IS NULL OR b.deadline IS NULL
       OR abs(extract(epoch FROM (a.deadline - b.deadline))) <= 7 * 86400)
WITH NO DATA;

CREATE INDEX idx_v_tender_matches_a ON public.v_tender_matches(id_a);
CREATE INDEX idx_v_tender_matches_b ON public.v_tender_matches(id_b);
GRANT SELECT ON public.v_tender_matches TO authenticated, service_role;

CREATE TABLE IF NOT EXISTS public.tender_groups (
  tender_id uuid PRIMARY KEY REFERENCES public.tenders(id) ON DELETE CASCADE,
  group_id  uuid NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tender_groups_group ON public.tender_groups(group_id);
GRANT SELECT ON public.tender_groups TO authenticated, anon;
GRANT ALL    ON public.tender_groups TO service_role;
ALTER TABLE public.tender_groups ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tender_groups readable by all" ON public.tender_groups;
CREATE POLICY "tender_groups readable by all"
  ON public.tender_groups FOR SELECT USING (true);

CREATE OR REPLACE FUNCTION public.rebuild_tender_groups()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE cnt int;
BEGIN
  DELETE FROM public.tender_groups;
  INSERT INTO public.tender_groups (tender_id, group_id)
  SELECT id, id FROM public.tenders;

  LOOP
    WITH neighbor_min AS (
      SELECT tender_id, min(g) AS min_g
      FROM (
        SELECT tg.tender_id, tg.group_id AS g FROM public.tender_groups tg
        UNION ALL
        SELECT m.id_a, g2.group_id FROM public.v_tender_matches m
          JOIN public.tender_groups g2 ON g2.tender_id = m.id_b
        UNION ALL
        SELECT m.id_b, g1.group_id FROM public.v_tender_matches m
          JOIN public.tender_groups g1 ON g1.tender_id = m.id_a
      ) x GROUP BY tender_id
    )
    UPDATE public.tender_groups g
    SET group_id = nm.min_g, updated_at = now()
    FROM neighbor_min nm
    WHERE g.tender_id = nm.tender_id AND g.group_id <> nm.min_g;
    GET DIAGNOSTICS cnt = ROW_COUNT;
    EXIT WHEN cnt = 0;
  END LOOP;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.rebuild_tender_groups() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rebuild_tender_groups() TO service_role;

CREATE OR REPLACE FUNCTION public.refresh_tender_matching()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW public.v_tender_matches;
  PERFORM public.rebuild_tender_groups();
END;
$$;
REVOKE EXECUTE ON FUNCTION public.refresh_tender_matching() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.refresh_tender_matching() TO service_role;

DROP VIEW IF EXISTS public.v_tender_sources CASCADE;
CREATE VIEW public.v_tender_sources AS
SELECT t.id, t.reference, t.title, t.object, t.buyer_name, t.deadline, t.publication_date,
  t.source AS raw_source,
  CASE
    WHEN upper(coalesce(t.source, '')) = 'BOAMP' THEN 'BOAMP'
    WHEN upper(coalesce(t.source, '')) = 'TED'   THEN 'TED'
    ELSE 'Scraping'
  END AS source_category,
  lower(coalesce(t.source, 'unknown')) AS source_key,
  coalesce(tg.group_id::text, t.id::text) AS dedup_key
FROM public.tenders t
LEFT JOIN public.tender_groups tg ON tg.tender_id = t.id
WHERE coalesce(t.buyer_name, t.object, t.title) IS NOT NULL;
GRANT SELECT ON public.v_tender_sources TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_sourcing_kpis()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  WITH grouped AS (
    SELECT dedup_key,
      bool_or(source_category = 'BOAMP')    AS has_boamp,
      bool_or(source_category = 'Scraping') AS has_scrape,
      bool_or(source_category = 'TED')      AS has_ted
    FROM public.v_tender_sources GROUP BY dedup_key
  )
  SELECT jsonb_build_object(
    'total_tenders', (SELECT count(*) FROM public.tenders),
    'total_unique',  (SELECT count(*) FROM grouped),
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
  _filter text DEFAULT 'all', _limit int DEFAULT 50,
  _offset int DEFAULT 0, _search text DEFAULT NULL)
RETURNS TABLE(dedup_key text, title text, buyer_name text, deadline timestamptz,
  reference text, sources text[], source_keys text[], ids uuid[])
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

CREATE OR REPLACE FUNCTION public.get_sourcing_per_source()
RETURNS TABLE(source_key text, source_category text, total bigint, exclusives bigint, duplicates bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH dedup_size AS (
    SELECT dedup_key, count(DISTINCT source_category) AS n_cats
    FROM public.v_tender_sources GROUP BY dedup_key
  )
  SELECT v.source_key, v.source_category,
    count(DISTINCT v.dedup_key) AS total,
    count(DISTINCT v.dedup_key) FILTER (WHERE d.n_cats = 1) AS exclusives,
    count(DISTINCT v.dedup_key) FILTER (WHERE d.n_cats > 1) AS duplicates
  FROM public.v_tender_sources v
  JOIN dedup_size d ON d.dedup_key = v.dedup_key
  GROUP BY v.source_key, v.source_category
  ORDER BY total DESC;
$$;

CREATE OR REPLACE FUNCTION public.get_sourcing_dedup_details(_dedup_key text)
RETURNS TABLE(id uuid, source_category text, source_key text, raw_source text,
  reference text, publication_date date, source_url text,
  platform_display text, sourcing_url text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT t.id, v.source_category, v.source_key, v.raw_source,
    v.reference, v.publication_date, t.source_url,
    su.display_name AS platform_display, su.url AS sourcing_url
  FROM public.v_tender_sources v
  JOIN public.tenders t ON t.id = v.id
  LEFT JOIN public.sourcing_urls su ON lower(su.platform) = lower(v.source_key)
  WHERE v.dedup_key = _dedup_key
  ORDER BY v.publication_date DESC NULLS LAST;
$$;

GRANT EXECUTE ON FUNCTION public.get_sourcing_kpis()             TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.get_sourcing_coverage(text, int, int, text) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.get_sourcing_per_source()       TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.get_sourcing_dedup_details(text) TO authenticated, anon, service_role;
