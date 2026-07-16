
TRUNCATE TABLE
  public.tenders,
  public.award_notices,
  public.pipeline_items,
  public.pipeline_comments,
  public.saved_searches,
  public.alerts,
  public.dce_downloads,
  public.dce_uploads,
  public.tender_analyses,
  public.agent_runs,
  public.scrape_logs,
  public.ingest_cursors
RESTART IDENTITY CASCADE;

UPDATE public.sourcing_urls SET
  last_run_at = NULL,
  last_status = NULL,
  last_items_found = 0,
  last_items_inserted = 0,
  last_error = NULL;
