
CREATE OR REPLACE FUNCTION public.match_batch(_cat_a text, _cat_b text)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inserted int;
BEGIN
  -- Seuil strict sur le TITRE pour limiter les candidats GIN
  SET LOCAL pg_trgm.similarity_threshold = 0.85;
  INSERT INTO public.v_tender_matches (id_a, id_b, cat_a, cat_b, title_sim, buyer_sim)
  SELECT
    LEAST(a.id, b.id), GREATEST(a.id, b.id),
    CASE WHEN a.id < b.id THEN _cat_a ELSE _cat_b END,
    CASE WHEN a.id < b.id THEN _cat_b ELSE _cat_a END,
    similarity(a.title_norm, b.title_norm),
    similarity(a.buyer_norm, b.buyer_norm)
  FROM public.tenders a
  JOIN public.tenders b
    ON a.id <> b.id
   AND a.title_norm % b.title_norm    -- seuil 0.85 sur le titre via GIN
  WHERE (
      (upper(coalesce(a.source,'')) = upper(_cat_a)
       OR (_cat_a = 'Scraping' AND upper(coalesce(a.source,'')) NOT IN ('BOAMP','TED')))
      AND
      (upper(coalesce(b.source,'')) = upper(_cat_b)
       OR (_cat_b = 'Scraping' AND upper(coalesce(b.source,'')) NOT IN ('BOAMP','TED')))
    )
    AND length(a.title_norm) > 8 AND length(b.title_norm) > 8
    AND similarity(a.buyer_norm, b.buyer_norm) > 0.55
    AND (a.deadline IS NULL OR b.deadline IS NULL
         OR abs(extract(epoch FROM (a.deadline - b.deadline))) <= 7 * 86400)
  ON CONFLICT (id_a, id_b) DO NOTHING;
  GET DIAGNOSTICS inserted = ROW_COUNT;
  RETURN inserted;
END;
$$;
