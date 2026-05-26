UPDATE public.sourcing_urls
SET url = REPLACE(url, 'fuseaction=mpAW.rechM', 'fuseaction=marchesP.rechM'),
    last_status = NULL, last_error = NULL
WHERE url LIKE '%fuseaction=mpAW.rechM%'
  AND url NOT LIKE '%sarthe%';