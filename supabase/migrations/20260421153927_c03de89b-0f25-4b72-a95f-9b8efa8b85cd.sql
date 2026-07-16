UPDATE public.tenders
SET source_url = dce_url
WHERE dce_url IS NOT NULL
  AND dce_url ~* '^https?://'
  AND (
    source_url ILIKE '%EntrepriseAdvancedSearch%'
    OR source_url ILIKE '%AllCons%'
    OR source_url ILIKE '%page=recherche%'
    OR source_url ILIKE '%page=Entreprise.AccueilEntreprise%'
    OR source_url IS NULL
  )
  AND dce_url <> source_url;