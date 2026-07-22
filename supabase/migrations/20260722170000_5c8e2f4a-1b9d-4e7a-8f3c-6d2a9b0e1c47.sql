-- Dédoublonnage des republications BOAMP : le même AO est parfois republié
-- plusieurs fois (rectificatifs, republications) sous des références
-- différentes — mesuré : 283 groupes / ~315 fiches ouvertes en trop.
-- Règle prudente : ne toucher que les groupes au TITRE SPÉCIFIQUE (>= 25
-- caractères, hors libellés génériques type « Avis d'attribution » qui
-- peuvent recouvrir des marchés distincts), et garder la fiche la plus
-- récente de chaque groupe. Les doublons passent en « closed » (pas de
-- suppression : les références et le payload brut restent consultables).
--
-- Exécutée en production le 2026-07-22 : 312 fiches fermées.
-- Un cron horaire « dedup-republications-hourly » (prod, minute 45) rejoue
-- cette requête pour refermer les doublons que l'ingestion nocturne
-- pourrait rouvrir et nettoyer les futures republications.

WITH ranked AS (
  SELECT id, row_number() OVER (
    PARTITION BY lower(btrim(title)), lower(btrim(coalesce(buyer_name,''))), deadline
    ORDER BY created_at DESC, id
  ) AS rn
  FROM public.tenders
  WHERE status = 'open'
    AND length(btrim(title)) >= 25
    AND title !~* '^(avis d''attribution|avis de march|avis rectificatif|rectificatif|annulation|sans objet|sans titre)'
)
UPDATE public.tenders t SET status = 'closed'
FROM ranked r
WHERE t.id = r.id AND r.rn > 1;
