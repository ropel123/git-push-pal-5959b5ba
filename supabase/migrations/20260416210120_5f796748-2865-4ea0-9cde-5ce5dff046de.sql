ALTER TABLE public.dce_uploads ADD COLUMN agent_run_id uuid REFERENCES public.agent_runs(id) ON DELETE SET NULL;
CREATE INDEX idx_dce_uploads_agent_run_id ON public.dce_uploads(agent_run_id);