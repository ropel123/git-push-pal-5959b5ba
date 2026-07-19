-- C17/C18 (performance, purely additive): covering indexes for unindexed foreign
-- keys and the dce_downloads join columns. Plain CREATE INDEX (not CONCURRENTLY)
-- so it runs inside the migration transaction; these tables are small enough that
-- the brief lock is acceptable.
--
-- FKs deliberately SKIPPED because a covering index already exists in production:
--   award_notices(tender_id)   -> UNIQUE award_notices_tender_id_unique
--   buyer_follows(user_id)     -> idx_buyer_follows_user
--   subscriptions(user_id)     -> idx_subscriptions_user
--   agent_runs(tender_id)      -> idx_agent_runs_tender
--   ai_prompt_versions(prompt_id) -> idx_ai_prompt_versions_prompt
--   dce_uploads(agent_run_id)  -> idx_dce_uploads_agent_run_id
--   award_notices(sourcing_url_id) -> idx_award_notices_sourcing_url_id
--   pipeline_items(user_id)    -> composite (user_id, stage) + UNIQUE (user_id, tender_id)
--   memoir_conversations(user_id) -> composite (user_id, status)
--   ai_request_log(user_id)    -> composite (user_id, fn, created_at)

CREATE INDEX IF NOT EXISTS idx_alerts_user_id ON public.alerts (user_id);
CREATE INDEX IF NOT EXISTS idx_dce_uploads_tender_id ON public.dce_uploads (tender_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_comments_pipeline_item_id ON public.pipeline_comments (pipeline_item_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_comments_user_id ON public.pipeline_comments (user_id);
CREATE INDEX IF NOT EXISTS idx_tender_analyses_tender_id ON public.tender_analyses (tender_id);
CREATE INDEX IF NOT EXISTS idx_tender_analyses_user_id ON public.tender_analyses (user_id);
CREATE INDEX IF NOT EXISTS idx_dce_downloads_tender_id ON public.dce_downloads (tender_id);
CREATE INDEX IF NOT EXISTS idx_dce_downloads_user_id ON public.dce_downloads (user_id);
CREATE INDEX IF NOT EXISTS idx_saved_searches_user_id ON public.saved_searches (user_id);

-- ============================================================================
-- ROLLBACK:
--
-- DROP INDEX IF EXISTS public.idx_alerts_user_id;
-- DROP INDEX IF EXISTS public.idx_dce_uploads_tender_id;
-- DROP INDEX IF EXISTS public.idx_pipeline_comments_pipeline_item_id;
-- DROP INDEX IF EXISTS public.idx_pipeline_comments_user_id;
-- DROP INDEX IF EXISTS public.idx_tender_analyses_tender_id;
-- DROP INDEX IF EXISTS public.idx_tender_analyses_user_id;
-- DROP INDEX IF EXISTS public.idx_dce_downloads_tender_id;
-- DROP INDEX IF EXISTS public.idx_dce_downloads_user_id;
-- DROP INDEX IF EXISTS public.idx_saved_searches_user_id;
-- ============================================================================
