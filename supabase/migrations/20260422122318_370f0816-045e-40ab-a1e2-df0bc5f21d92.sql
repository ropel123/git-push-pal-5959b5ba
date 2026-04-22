-- 1. Nettoyer les références polluées (préfixes "réf.", "ref.", "n°", "numéro", "référence")
UPDATE public.tenders
SET reference = regexp_replace(
  reference,
  '^\s*(réf\.?|ref\.?|référence|reference|n°|numéro|num\.?)\s*[:°\-–]?\s*',
  '',
  'i'
)
WHERE reference ~* '^\s*(réf|ref|référence|reference|n°|numéro|num)\b';

-- 2. Dédupliquer (source, reference) en gardant la ligne avec le meilleur dce_url
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY source, reference
      ORDER BY
        (CASE
          WHEN dce_url ~* '(refPub=|refConsult=|/consultation/|[?&]IDS?=\d|[?&]id=\d)' THEN 0
          WHEN dce_url IS NOT NULL AND dce_url <> '' THEN 1
          ELSE 2
         END),
        created_at DESC
    ) AS rn
  FROM public.tenders
  WHERE reference IS NOT NULL AND reference <> ''
)
DELETE FROM public.tenders t
USING ranked r
WHERE t.id = r.id AND r.rn > 1;

-- 3. Vider les dce_url et source_url qui sont des pages de listing génériques
UPDATE public.tenders
SET dce_url = NULL
WHERE dce_url IS NOT NULL
  AND (
    (dce_url ~* 'fuseaction=pub\.affResultats' AND dce_url !~* '(refPub=|refConsult=)')
    OR dce_url ~* 'EntrepriseAdvancedSearch'
    OR dce_url ~* '[?&]AllCons\b'
    OR dce_url ~* 'page=recherche'
  );

UPDATE public.tenders
SET source_url = NULL
WHERE source_url IS NOT NULL
  AND (
    (source_url ~* 'fuseaction=pub\.affResultats' AND source_url !~* '(refPub=|refConsult=)')
    OR source_url ~* 'EntrepriseAdvancedSearch'
    OR source_url ~* '[?&]AllCons\b'
    OR source_url ~* 'page=recherche'
  );