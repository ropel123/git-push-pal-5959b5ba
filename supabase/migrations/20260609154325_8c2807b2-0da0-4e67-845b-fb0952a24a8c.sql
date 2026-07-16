
DROP MATERIALIZED VIEW IF EXISTS public.v_tender_matches CASCADE;

CREATE MATERIALIZED VIEW public.v_tender_matches AS
SELECT
  a.id AS id_a, b.id AS id_b,
  CASE WHEN upper(coalesce(a.source,''))='BOAMP' THEN 'BOAMP'
       WHEN upper(coalesce(a.source,''))='TED' THEN 'TED' ELSE 'Scraping' END AS cat_a,
  CASE WHEN upper(coalesce(b.source,''))='BOAMP' THEN 'BOAMP'
       WHEN upper(coalesce(b.source,''))='TED' THEN 'TED' ELSE 'Scraping' END AS cat_b,
  similarity(public.match_norm(a.title), public.match_norm(b.title)) AS title_sim,
  similarity(public.match_norm(a.buyer_name), public.match_norm(b.buyer_name)) AS buyer_sim
FROM public.tenders a
JOIN public.tenders b
  ON b.id > a.id
 AND public.match_norm(a.title)      % public.match_norm(b.title)
 AND public.match_norm(a.buyer_name) % public.match_norm(b.buyer_name)
WHERE a.title IS NOT NULL AND b.title IS NOT NULL
  AND a.buyer_name IS NOT NULL AND b.buyer_name IS NOT NULL
  AND length(public.match_norm(a.title)) > 8
  AND length(public.match_norm(b.title)) > 8
  AND (CASE WHEN upper(coalesce(a.source,''))='BOAMP' THEN 'BOAMP'
            WHEN upper(coalesce(a.source,''))='TED' THEN 'TED' ELSE 'Scraping' END)
   <> (CASE WHEN upper(coalesce(b.source,''))='BOAMP' THEN 'BOAMP'
            WHEN upper(coalesce(b.source,''))='TED' THEN 'TED' ELSE 'Scraping' END)
  AND similarity(public.match_norm(a.title), public.match_norm(b.title)) > 0.85
  AND similarity(public.match_norm(a.buyer_name), public.match_norm(b.buyer_name)) > 0.55
  AND (a.deadline IS NULL OR b.deadline IS NULL
       OR abs(extract(epoch FROM (a.deadline - b.deadline))) <= 7 * 86400)
WITH NO DATA;

CREATE INDEX idx_v_tender_matches_a ON public.v_tender_matches(id_a);
CREATE INDEX idx_v_tender_matches_b ON public.v_tender_matches(id_b);
GRANT SELECT ON public.v_tender_matches TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.refresh_tender_matching()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  SET LOCAL pg_trgm.similarity_threshold = 0.55;
  REFRESH MATERIALIZED VIEW public.v_tender_matches;
  PERFORM public.rebuild_tender_groups();
END;
$$;
REVOKE EXECUTE ON FUNCTION public.refresh_tender_matching() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.refresh_tender_matching() TO service_role;
