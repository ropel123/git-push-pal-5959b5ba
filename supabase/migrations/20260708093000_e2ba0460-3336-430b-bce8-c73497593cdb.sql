-- Sourcing — Étape B : détection Atexo par signature d'URL.
-- Certains portails Atexo/Local-Trust tournent sur des domaines de collectivités
-- (mairie-marseille, departement13, marchespublics596280…) non détectables au
-- seul nom de domaine. Ils exposent en revanche une signature d'URL propre à
-- Atexo (?page=Entreprise., orgAcronyme=, page=commun.InfoSite).
-- On l'évalue sur TOUTES les URLs d'un host (bool_or), pas seulement l'échantillon,
-- et en dernier recours après le fingerprint IA et le nom de domaine spécifique
-- (donc aucun host déjà bien classé — place, dematis, adullact… — n'est modifié).
-- Vérifié : 0 faux positif (aucun éditeur non-Atexo ne porte cette signature).
-- CREATE OR REPLACE => idempotent.
CREATE OR REPLACE FUNCTION public.get_dce_sourcing_by_fingerprint(_search text DEFAULT NULL::text, _category text DEFAULT NULL::text)
 RETURNS TABLE(host text, platform text, category text, fingerprint_source text, confidence numeric, boamp_count bigint, ted_count bigint, total_count bigint, sample_tender_id uuid, sample_dce_url text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
      (array_agg(dce_url ORDER BY length(dce_url)))[1] AS sample_dce_url,
      -- Signature d'URL Atexo / Local Trust MPE, évaluée sur toutes les URLs du host
      bool_or(
        lower(dce_url) LIKE '%?page=entreprise.%'
        OR lower(dce_url) LIKE '%orgacronyme=%'
        OR lower(dce_url) LIKE '%page=commun.infosite%'
      ) AS url_is_atexo
    FROM tender_hosts
    WHERE host IS NOT NULL AND host <> ''
    GROUP BY host
  ),
  joined AS (
    SELECT
      a.host,
      pf.platform,
      COALESCE(
        -- 1. Fingerprint IA
        public.platform_ts_to_category(pf.platform),
        -- 2. Nom de domaine spécifique (on ignore les valeurs génériques)
        NULLIF(NULLIF(NULLIF(public.platform_category(a.host), 'autre'), 'inconnu'), 'autre-mp'),
        -- 3. Signature d'URL Atexo (étape B)
        CASE WHEN a.url_is_atexo THEN 'atexo' END,
        -- 4. Repli : nom de domaine générique (autre-mp / autre / inconnu)
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
$function$;
