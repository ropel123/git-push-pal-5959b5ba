-- Hardening (advisors 0028/0029): revoke EXECUTE on SECURITY DEFINER functions
-- from the anonymous role (and PUBLIC) so they can no longer be invoked via
-- /rest/v1/rpc/... without signing in. `authenticated` and `service_role` keep
-- EXECUTE where the app / edge functions legitimately need it.
--
-- Safety rationale:
--  * has_role: referenced ONLY inside RLS policies, all of which are TO authenticated
--    (no anon-facing policy uses it). RLS evaluation by a signed-in user needs the
--    `authenticated` EXECUTE grant, which is KEPT — so RLS is unaffected. anon never
--    needs it.
--  * handle_new_user: a trigger function (on_auth_user_created AFTER INSERT ON
--    auth.users). Trigger firing does NOT depend on the DML role's EXECUTE grant, so
--    revoking anon/authenticated/PUBLIC does NOT affect sign-up. It is never a
--    legitimate RPC target.
--  * get_dce_sourcing_by_fingerprint: called by edge fn reclassify-all-hosts
--    (service_role) and useDceSourcing (authenticated) — both KEPT, anon revoked.
--  * get_distinct_tender_procedures / get_distinct_tender_sources /
--    get_unprocessed_tenders: only ever called by signed-in app / service_role —
--    anon revoked, authenticated + service_role kept.

-- Trigger-only function: no role needs RPC EXECUTE.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- RLS helper: keep authenticated (needed for policy evaluation) + service_role.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;

-- Reporting / sourcing RPCs: keep authenticated + service_role, drop anon + PUBLIC.
REVOKE EXECUTE ON FUNCTION public.get_dce_sourcing_by_fingerprint(text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_distinct_tender_procedures() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_distinct_tender_sources() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_unprocessed_tenders(integer, text) FROM PUBLIC, anon;

-- ============================================================================
-- ROLLBACK (restore the prior default grants):
--
-- GRANT EXECUTE ON FUNCTION public.handle_new_user() TO PUBLIC, anon, authenticated;
-- GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO PUBLIC, anon;
-- GRANT EXECUTE ON FUNCTION public.get_dce_sourcing_by_fingerprint(text, text) TO anon;
-- GRANT EXECUTE ON FUNCTION public.get_distinct_tender_procedures() TO PUBLIC, anon;
-- GRANT EXECUTE ON FUNCTION public.get_distinct_tender_sources() TO PUBLIC, anon;
-- GRANT EXECUTE ON FUNCTION public.get_unprocessed_tenders(integer, text) TO PUBLIC, anon;
-- ============================================================================
