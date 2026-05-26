UPDATE public.sourcing_urls
SET url = REPLACE(url, 'fuseaction=pub.affResultats', 'fuseaction=mpAW.rechM'),
    last_status = NULL,
    last_error = NULL
WHERE url LIKE '%fuseaction=pub.affResultats%';