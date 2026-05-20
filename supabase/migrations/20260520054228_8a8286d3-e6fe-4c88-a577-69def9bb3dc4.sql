CREATE INDEX IF NOT EXISTS idx_tenders_status ON public.tenders (status);
CREATE INDEX IF NOT EXISTS idx_tenders_region ON public.tenders (region);
CREATE INDEX IF NOT EXISTS idx_tenders_deadline ON public.tenders (deadline);
CREATE INDEX IF NOT EXISTS idx_tenders_created_at ON public.tenders (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pipeline_items_user_stage ON public.pipeline_items (user_id, stage);