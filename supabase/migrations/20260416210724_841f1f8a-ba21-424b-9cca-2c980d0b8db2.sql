-- Backfill orphan dce_uploads: link to their agent_run by temporal proximity
UPDATE public.dce_uploads u
SET agent_run_id = r.id
FROM public.agent_runs r
WHERE u.agent_run_id IS NULL
  AND u.tender_id = r.tender_id
  AND u.created_at BETWEEN r.started_at AND COALESCE(r.finished_at, r.started_at + interval '10 minutes');