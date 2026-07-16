-- v3.9: enable pg_cron + pg_net and schedule hourly atexo-backfill
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Drop any previous version of the same job
DO $$
DECLARE jid bigint;
BEGIN
  SELECT jobid INTO jid FROM cron.job WHERE jobname = 'atexo-backfill-hourly';
  IF jid IS NOT NULL THEN PERFORM cron.unschedule(jid); END IF;
END $$;

SELECT cron.schedule(
  'atexo-backfill-hourly',
  '7 * * * *',
  $$
  SELECT net.http_post(
    url:='https://xfqvaeshidleazgfqlze.supabase.co/functions/v1/atexo-backfill',
    headers:='{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhmcXZhZXNoaWRsZWF6Z2ZxbHplIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE4NjU0MjgsImV4cCI6MjA4NzQ0MTQyOH0.SbhOoNCAD2t62h8aLc62LiTDYw6DeDEzMaF-hdaoUuk"}'::jsonb,
    body:='{"batchSize":80}'::jsonb
  );
  $$
);