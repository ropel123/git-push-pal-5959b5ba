-- B39 (documentation): ai_request_log has RLS enabled with NO policies. That is
-- intentional — only edge functions write to it via service_role (which bypasses
-- RLS), and clients must have no access. Document this on the table so future
-- audits do not mistake it for a misconfiguration.

COMMENT ON TABLE public.ai_request_log IS 'Rate-limit log written by edge functions via service_role only; RLS enabled with no policies is intentional (no client access).';

-- ============================================================================
-- ROLLBACK:
--
-- COMMENT ON TABLE public.ai_request_log IS NULL;
-- ============================================================================
