SELECT cron.schedule(
  'batch-fetch-dce-every-minute',
  '* * * * *',
  $$
  SELECT net.http_post(
    url:='https://xfqvaeshidleazgfqlze.supabase.co/functions/v1/batch-fetch-dce',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhmcXZhZXNoaWRsZWF6Z2ZxbHplIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE4NjU0MjgsImV4cCI6MjA4NzQ0MTQyOH0.SbhOoNCAD2t62h8aLc62LiTDYw6DeDEzMaF-hdaoUuk"}'::jsonb,
    body:='{"limit": 5}'::jsonb
  ) as request_id;
  $$
);