-- Cleanup des 9 fiches Atexo résiduelles non-enrichissables
-- 7 fiches sans source_url (ancien executor v3.3) + 2 avec source_url mais détail HTTP en échec
UPDATE public.tenders
SET 
  title = CASE 
    WHEN title ILIKE 'Accéder%' OR title ILIKE 'Acceder%' 
      THEN 'Consultation Atexo (archivée)'
    WHEN title ~* '^Consultation [0-9]+$' 
      THEN 'Consultation Atexo (archivée)'
    ELSE title 
  END,
  buyer_name = CASE 
    WHEN buyer_name IS NULL OR buyer_name ~ '^[a-zA-Z0-9\-]{2,20}$' 
      THEN 'Acheteur public (non identifié)'
    ELSE buyer_name 
  END,
  status = 'closed'::tender_status,
  enriched_data = jsonb_set(
    COALESCE(enriched_data, '{}'::jsonb),
    '{backfill_skip}', 'true'::jsonb,
    true
  )
WHERE (
  -- Catégorie A: pas de source_url avec titre placeholder
  (source_url IS NULL AND (title ILIKE 'Accéder%' OR title ILIKE 'Acceder%' OR title ~* '^Consultation [0-9]+$'))
  OR
  -- Catégorie B: source_url Atexo mais titre placeholder résiduel après plusieurs tentatives
  (source_url ILIKE '%/entreprise/consultation/%' 
    AND (title ILIKE 'Accéder%' OR title ILIKE 'Acceder%'))
);