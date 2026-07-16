CREATE OR REPLACE FUNCTION public.get_unprocessed_tenders(
  _limit integer DEFAULT 5,
  _platform_filter text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  dce_url text,
  title text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT t.id, t.dce_url, t.title
  FROM tenders t
  LEFT JOIN dce_downloads d ON d.tender_id = t.id
  WHERE t.dce_url IS NOT NULL
    AND t.dce_url != ''
    AND d.id IS NULL
  ORDER BY t.created_at DESC
  LIMIT _limit;
$$;