
ALTER TABLE public.tenders
  ADD COLUMN IF NOT EXISTS title_norm text,
  ADD COLUMN IF NOT EXISTS buyer_norm text;

-- Trigger pour maintenir les colonnes normalisées
CREATE OR REPLACE FUNCTION public.tenders_norm_trigger()
RETURNS trigger LANGUAGE plpgsql
SET search_path = public, extensions
AS $$
BEGIN
  NEW.title_norm := public.match_norm(NEW.title);
  NEW.buyer_norm := public.match_norm(NEW.buyer_name);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_tenders_norm ON public.tenders;
CREATE TRIGGER trg_tenders_norm
  BEFORE INSERT OR UPDATE OF title, buyer_name
  ON public.tenders
  FOR EACH ROW EXECUTE FUNCTION public.tenders_norm_trigger();

-- Backfill initial
UPDATE public.tenders SET title_norm = public.match_norm(title), buyer_norm = public.match_norm(buyer_name)
WHERE title_norm IS NULL OR buyer_norm IS NULL;

-- Index trigram sur les colonnes stockées
DROP INDEX IF EXISTS public.idx_tenders_title_trgm;
DROP INDEX IF EXISTS public.idx_tenders_buyer_trgm;
DROP INDEX IF EXISTS public.idx_tenders_title_norm_trgm;
DROP INDEX IF EXISTS public.idx_tenders_buyer_norm_trgm;
CREATE INDEX idx_tenders_title_norm_trgm ON public.tenders USING gin (title_norm gin_trgm_ops);
CREATE INDEX idx_tenders_buyer_norm_trgm ON public.tenders USING gin (buyer_norm gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_tenders_source ON public.tenders(source);

-- match_batch utilise les colonnes stockées
CREATE OR REPLACE FUNCTION public.match_batch(_cat_a text, _cat_b text)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inserted int;
BEGIN
  SET LOCAL pg_trgm.similarity_threshold = 0.55;
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
   AND a.title_norm % b.title_norm
   AND a.buyer_norm % b.buyer_norm
  WHERE (
      (upper(coalesce(a.source,'')) = upper(_cat_a)
       OR (_cat_a = 'Scraping' AND upper(coalesce(a.source,'')) NOT IN ('BOAMP','TED')))
      AND
      (upper(coalesce(b.source,'')) = upper(_cat_b)
       OR (_cat_b = 'Scraping' AND upper(coalesce(b.source,'')) NOT IN ('BOAMP','TED')))
    )
    AND length(a.title_norm) > 8 AND length(b.title_norm) > 8
    AND similarity(a.title_norm, b.title_norm) > 0.85
    AND similarity(a.buyer_norm, b.buyer_norm) > 0.55
    AND (a.deadline IS NULL OR b.deadline IS NULL
         OR abs(extract(epoch FROM (a.deadline - b.deadline))) <= 7 * 86400)
  ON CONFLICT (id_a, id_b) DO NOTHING;
  GET DIAGNOSTICS inserted = ROW_COUNT;
  RETURN inserted;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.match_batch(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.match_batch(text, text) TO service_role;
