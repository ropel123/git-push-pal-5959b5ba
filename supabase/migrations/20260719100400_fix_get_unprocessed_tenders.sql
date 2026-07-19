-- B41 (minor fix): get_unprocessed_tenders declared _platform_filter but never
-- used it. This version implements the filter.
--
-- Chosen interpretation (simplest correct one): when _platform_filter is non-null
-- and non-empty, keep only tenders whose dce_url contains the filter string,
-- case-insensitively (dce_url ILIKE '%' || _platform_filter || '%'). Callers pass
-- a host fragment or platform slug (e.g. 'marches-publics.gouv.fr', 'awsolutions',
-- 'atexo'), which always appears in the tender's dce_url for that platform. This
-- avoids coupling the function to the platform_host_norm/platform_category
-- mapping while matching every practical use of the parameter. NULL or empty
-- (after trim) filter = no filtering, i.e. previous behaviour.
--
-- Signature, return columns (id, dce_url, title), SECURITY DEFINER, STABLE and
-- search_path=public are unchanged.

CREATE OR REPLACE FUNCTION public.get_unprocessed_tenders(_limit integer DEFAULT 5, _platform_filter text DEFAULT NULL::text)
 RETURNS TABLE(id uuid, dce_url text, title text)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT t.id, t.dce_url, t.title
  FROM tenders t
  LEFT JOIN dce_downloads d ON d.tender_id = t.id
  WHERE t.dce_url IS NOT NULL AND t.dce_url != '' AND d.id IS NULL
    AND (
      _platform_filter IS NULL
      OR btrim(_platform_filter) = ''
      OR t.dce_url ILIKE '%' || _platform_filter || '%'
    )
  ORDER BY t.created_at DESC
  LIMIT _limit;
$function$;

-- ============================================================================
-- ROLLBACK (restores the prior definition, which ignores _platform_filter):
--
-- CREATE OR REPLACE FUNCTION public.get_unprocessed_tenders(_limit integer DEFAULT 5, _platform_filter text DEFAULT NULL::text)
--  RETURNS TABLE(id uuid, dce_url text, title text)
--  LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
-- AS $prior$
--   SELECT t.id, t.dce_url, t.title
--   FROM tenders t
--   LEFT JOIN dce_downloads d ON d.tender_id = t.id
--   WHERE t.dce_url IS NOT NULL AND t.dce_url != '' AND d.id IS NULL
--   ORDER BY t.created_at DESC
--   LIMIT _limit;
-- $prior$;
-- ============================================================================
