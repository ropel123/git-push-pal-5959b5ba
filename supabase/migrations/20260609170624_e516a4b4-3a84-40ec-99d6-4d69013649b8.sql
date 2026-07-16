CREATE OR REPLACE FUNCTION public.platform_category(_host text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN _host IS NULL OR _host = '' THEN 'inconnu'
    WHEN _host LIKE '%marches-publics.gouv.fr%'
      OR _host LIKE '%marches-publics.finances.gouv.fr%'
      OR _host LIKE '%place.marches-publics%' THEN 'place'
    WHEN _host LIKE '%e-marchespublics.com%'
      OR _host LIKE '%emarchespublics.com%' THEN 'dematis'
    WHEN _host LIKE '%atexo%'
      OR _host LIKE '%alsacemarchespublics.eu%'
      OR _host LIKE '%demat-ampa%' THEN 'atexo'
    WHEN _host LIKE '%marches-publics.info%'
      OR _host LIKE '%mpiaws%' THEN 'mpi'
    WHEN _host LIKE '%achatpublic.com%' THEN 'achatpublic'
    WHEN _host LIKE '%marches-securises.fr%' THEN 'marches-securises'
    WHEN _host LIKE '%maximilien.fr%' OR _host LIKE '%maximilien%' THEN 'maximilien'
    WHEN _host LIKE '%klekoon.com%' THEN 'klekoon'
    WHEN _host LIKE '%safetender%' OR _host LIKE '%omnikles%' THEN 'safetender'
    WHEN _host LIKE '%aws-france.com%' OR _host LIKE '%aws-entreprises.com%' THEN 'aws'
    WHEN _host LIKE '%xmarches.fr%' THEN 'xmarches'
    WHEN _host LIKE '%anjoumarchespublics.fr%' THEN 'anjou'
    WHEN _host LIKE '%megalis.bretagne%' THEN 'megalis'
    WHEN _host LIKE '%marchespublics%' THEN 'autre-mp'
    ELSE 'autre'
  END
$function$;