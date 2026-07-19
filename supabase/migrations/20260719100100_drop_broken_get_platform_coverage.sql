-- S7: drop both overloads of public.get_platform_coverage.
-- They reference public.sourcing_urls, which was dropped in migration 20260610122527,
-- so both overloads error at call time ("relation sourcing_urls does not exist").
-- Nothing live calls them: the only remaining references are the generated TypeScript
-- types (src/integrations/supabase/types.ts), which are inert.

DROP FUNCTION IF EXISTS public.get_platform_coverage(text, text, integer, integer);
DROP FUNCTION IF EXISTS public.get_platform_coverage(text, text, integer, integer, text);

-- ============================================================================
-- ROLLBACK:
-- These functions are removed as dead/broken code. No automatic restore is
-- provided because any restored body would still reference the dropped
-- public.sourcing_urls table and remain broken. If they are ever needed again,
-- the historical definitions live in migrations:
--   20260609163003_2ba0d01a-8762-470f-b7e4-94262eb54053.sql
--   20260609170221_6ad74aa8-513a-4d49-9c68-5cce697dbe1e.sql
--   20260609180656_49ecf549-5959-47a0-b8bc-dbd52e61294b.sql
-- (restoring them would also require recreating sourcing_urls).
-- ============================================================================
