
SELECT cron.schedule(
  'scrape-boamp-daily',
  '0 2 * * *',
  $$
  SELECT net.http_post(
    url := 'https://xfqvaeshidleazgfqlze.supabase.co/functions/v1/scrape-boamp',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhmcXZhZXNoaWRsZWF6Z2ZxbHplIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE4NjU0MjgsImV4cCI6MjA4NzQ0MTQyOH0.SbhOoNCAD2t62h8aLc62LiTDYw6DeDEzMaF-hdaoUuk"}'::jsonb,
    body := concat('{"time": "', now(), '"}')::jsonb
  ) AS request_id;
  $$
);

SELECT cron.schedule(
  'scrape-ted-daily',
  '0 3 * * *',
  $$
  SELECT net.http_post(
    url := 'https://xfqvaeshidleazgfqlze.supabase.co/functions/v1/scrape-ted',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhmcXZhZXNoaWRsZWF6Z2ZxbHplIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE4NjU0MjgsImV4cCI6MjA4NzQ0MTQyOH0.SbhOoNCAD2t62h8aLc62LiTDYw6DeDEzMaF-hdaoUuk"}'::jsonb,
    body := concat('{"time": "', now(), '"}')::jsonb
  ) AS request_id;
  $$
);
