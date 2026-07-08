-- Sourcing — Étape A : reconnaissance de 5 éditeurs supplémentaires au nom de
-- domaine dans platform_category(). Audit du 2026-07-08 : ces hosts étaient
-- classés 'autre' (inconnu) alors qu'ils appartiennent à des éditeurs connus.
-- Vérifié : aucun de ces motifs ne recouvre un host déjà classé (zéro régression).
-- CREATE OR REPLACE => idempotent.
CREATE OR REPLACE FUNCTION public.platform_category(_host text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN _host IS NULL OR _host = '' THEN 'inconnu'
    -- PLACE (État) — inclut désormais l'intranet RIE (finances.rie.gouv.fr)
    WHEN _host LIKE '%marches-publics.gouv.fr%'
      OR _host LIKE '%marches-publics.finances%gouv.fr%'
      OR _host LIKE '%place.marches-publics%' THEN 'place'
    -- Dematis (concurrent d'Atexo, à isoler avant)
    WHEN _host LIKE '%e-marchespublics.com%'
      OR _host LIKE '%emarchespublics.com%' THEN 'dematis'
    -- ADULLACT web-Marché (fork libre Local Trust, opérateur distinct d'Atexo)
    WHEN _host LIKE '%adullact.org%' THEN 'adullact'
    -- Famille Atexo (même moteur PRADO/SDM) :
    --   sous-marques connues + déclinaisons régionales hébergées par Atexo
    WHEN _host LIKE '%atexo%'
      OR _host LIKE '%alsacemarchespublics.eu%'
      OR _host LIKE '%demat-ampa%'
      OR _host LIKE '%maximilien.fr%'
      OR _host LIKE '%maximilien%'
      OR _host LIKE '%megalis.bretagne%'
      OR _host LIKE '%ternum-bfc%'
      OR _host LIKE '%auvergnerhonealpes.eu%'
      OR _host LIKE '%ampmetropole.fr%'
      OR _host LIKE '%nantesmetropole.fr%'
      OR _host LIKE '%paysdelaloire.fr%'
      OR _host LIKE '%marchespublics.adm76%'
      OR _host LIKE '%profilacheteur.%'
      OR _host LIKE '%local-trust.com%' THEN 'atexo'
    -- MPI (Marchés Publics Info)
    WHEN _host LIKE '%marches-publics.info%'
      OR _host LIKE '%mpiaws%' THEN 'mpi'
    WHEN _host LIKE '%achatpublic.com%' THEN 'achatpublic'
    WHEN _host LIKE '%marches-securises.fr%' THEN 'marches-securises'
    WHEN _host LIKE '%klekoon.com%' THEN 'klekoon'
    WHEN _host LIKE '%safetender%' OR _host LIKE '%omnikles%' THEN 'safetender'
    WHEN _host LIKE '%aws-france.com%'
      OR _host LIKE '%aws-entreprises.com%'
      OR _host LIKE '%aws-achat.info%'
      OR _host LIKE '%mpe76.fr%' THEN 'aws'
    WHEN _host LIKE '%xmarches.fr%' THEN 'xmarches'
    WHEN _host LIKE '%anjoumarchespublics.fr%' THEN 'anjou'
    -- Nouveaux éditeurs reconnus au nom de domaine (audit 2026-07-08)
    WHEN _host LIKE '%bravosolution.com%' THEN 'bravo'
    WHEN _host LIKE '%aji-france.com%' THEN 'aji'
    WHEN _host LIKE '%synapse-entreprises.com%' THEN 'synapse'
    WHEN _host LIKE '%marchesonline.com%' THEN 'marchesonline'
    WHEN _host LIKE '%medialex.fr%' THEN 'medialex'
    WHEN _host LIKE '%marchespublics%' THEN 'autre-mp'
    ELSE 'autre'
  END
$function$;
