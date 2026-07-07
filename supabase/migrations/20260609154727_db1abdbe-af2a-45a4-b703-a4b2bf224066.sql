
DROP MATERIALIZED VIEW IF EXISTS public.v_tender_matches CASCADE;

CREATE TABLE public.v_tender_matches (
  id_a uuid NOT NULL,
  id_b uuid NOT NULL,
  cat_a text NOT NULL,
  cat_b text NOT NULL,
  title_sim real NOT NULL,
  buyer_sim real NOT NULL,
  PRIMARY KEY (id_a, id_b)
);
CREATE INDEX idx_v_tender_matches_a ON public.v_tender_matches(id_a);
CREATE INDEX idx_v_tender_matches_b ON public.v_tender_matches(id_b);
GRANT SELECT ON public.v_tender_matches TO authenticated, service_role;
GRANT ALL ON public.v_tender_matches TO service_role;
ALTER TABLE public.v_tender_matches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "matches readable" ON public.v_tender_matches FOR SELECT USING (true);

-- Fonction qui insère les paires pour UNE combinaison de catégories
CREATE OR REPLACE FUNCTION public.match_batch(_cat_a text, _cat_b text)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inserted int;
BEGIN
  SET LOCAL pg_trgm.similarity_threshold = 0.55;
  WITH a_src AS (
    SELECT id, title, buyer_name, deadline,
           public.match_norm(title) AS title_n,
           public.match_norm(buyer_name) AS buyer_n
    FROM public.tenders
    WHERE upper(coalesce(source,'')) = upper(_cat_a) OR
          (_cat_a = 'Scraping' AND upper(coalesce(source,'')) NOT IN ('BOAMP','TED'))
  ),
  b_src AS (
    SELECT id, title, buyer_name, deadline,
           public.match_norm(title) AS title_n,
           public.match_norm(buyer_name) AS buyer_n
    FROM public.tenders
    WHERE upper(coalesce(source,'')) = upper(_cat_b) OR
          (_cat_b = 'Scraping' AND upper(coalesce(source,'')) NOT IN ('BOAMP','TED'))
  )
  INSERT INTO public.v_tender_matches (id_a, id_b, cat_a, cat_b, title_sim, buyer_sim)
  SELECT
    LEAST(a.id, b.id), GREATEST(a.id, b.id),
    CASE WHEN a.id < b.id THEN _cat_a ELSE _cat_b END,
    CASE WHEN a.id < b.id THEN _cat_b ELSE _cat_a END,
    similarity(a.title_n, b.title_n),
    similarity(a.buyer_n, b.buyer_n)
  FROM a_src a
  JOIN b_src b
    ON a.id <> b.id
   AND a.title_n % b.title_n
   AND a.buyer_n % b.buyer_n
  WHERE length(a.title_n) > 8 AND length(b.title_n) > 8
    AND similarity(a.title_n, b.title_n) > 0.85
    AND similarity(a.buyer_n, b.buyer_n) > 0.55
    AND (a.deadline IS NULL OR b.deadline IS NULL
         OR abs(extract(epoch FROM (a.deadline - b.deadline))) <= 7 * 86400)
  ON CONFLICT (id_a, id_b) DO NOTHING;
  GET DIAGNOSTICS inserted = ROW_COUNT;
  RETURN inserted;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.match_batch(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.match_batch(text, text) TO service_role;

CREATE OR REPLACE FUNCTION public.refresh_tender_matching()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  TRUNCATE public.v_tender_matches;
  PERFORM public.match_batch('BOAMP', 'Scraping');
  PERFORM public.match_batch('TED',   'Scraping');
  PERFORM public.match_batch('BOAMP', 'TED');
  PERFORM public.rebuild_tender_groups();
END;
$$;
REVOKE EXECUTE ON FUNCTION public.refresh_tender_matching() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.refresh_tender_matching() TO service_role;
