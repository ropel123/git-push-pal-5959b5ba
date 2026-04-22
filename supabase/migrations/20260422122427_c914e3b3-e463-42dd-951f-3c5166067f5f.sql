-- 1. Supprimer les lignes "réf. X" quand une version "X" existe déjà pour la même source.
-- On garde celle qui a le meilleur dce_url.
WITH polluted AS (
  SELECT id, source,
    regexp_replace(reference, '^\s*(réf\.?|ref\.?|référence|reference|n°|numéro|num\.?)\s*[:°\-–]?\s*', '', 'i') AS clean_ref,
    dce_url, created_at
  FROM public.tenders
  WHERE reference ~* '^\s*(réf|ref|référence|reference|n°|numéro|num)'
),
all_candidates AS (
  -- Lignes polluées + leurs jumelles "propres"
  SELECT t.id, t.source, t.reference AS ref_value, t.dce_url, t.created_at,
         p.clean_ref AS group_key, 'polluted' AS origin
  FROM public.tenders t
  JOIN polluted p ON p.id = t.id
  UNION
  SELECT t.id, t.source, t.reference, t.dce_url, t.created_at,
         t.reference AS group_key, 'clean' AS origin
  FROM public.tenders t
  JOIN polluted p ON p.source = t.source AND p.clean_ref = t.reference
),
ranked AS (
  SELECT id, source, group_key,
    ROW_NUMBER() OVER (
      PARTITION BY source, group_key
      ORDER BY
        (CASE
          WHEN dce_url ~* '(refPub=|refConsult=|/consultation/|[?&]IDS?=\d|[?&]id=\d)' THEN 0
          WHEN dce_url IS NOT NULL AND dce_url <> '' THEN 1
          ELSE 2
         END),
        (CASE WHEN origin = 'clean' THEN 0 ELSE 1 END),
        created_at DESC
    ) AS rn
  FROM all_candidates
)
DELETE FROM public.tenders t
USING ranked r
WHERE t.id = r.id AND r.rn > 1;

-- 2. Maintenant qu'il n'y a plus de collisions, nettoyer les préfixes.
UPDATE public.tenders
SET reference = regexp_replace(
  reference,
  '^\s*(réf\.?|ref\.?|référence|reference|n°|numéro|num\.?)\s*[:°\-–]?\s*',
  '',
  'i'
)
WHERE reference ~* '^\s*(réf|ref|référence|reference|n°|numéro|num)';