CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Drop existing job if already created
DO $$
BEGIN
  PERFORM cron.unschedule('sourcing-scheduler-6h');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'sourcing-scheduler-6h',
  '5 */6 * * *',
  $$
  SELECT net.http_post(
    url := 'https://xfqvaeshidleazgfqlze.supabase.co/functions/v1/sourcing-scheduler',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhmcXZhZXNoaWRsZWF6Z2ZxbHplIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE4NjU0MjgsImV4cCI6MjA4NzQ0MTQyOH0.SbhOoNCAD2t62h8aLc62LiTDYw6DeDEzMaF-hdaoUuk"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);