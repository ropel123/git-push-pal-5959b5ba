-- S6 (security): subscriptions must be written ONLY by the Stripe webhook (service_role).
-- The original policies (migration 20260609144709) let any signed-in user INSERT/UPDATE
-- their own subscription row, i.e. self-grant status='active' without paying.
--
-- Note: service_role BYPASSES RLS entirely (rolbypassrls), so the stripe-webhook edge
-- function (supabase/functions/stripe-webhook/index.ts, which uses the service role key)
-- keeps full write access after these policies are dropped. Clients keep read access via
-- the untouched "Users read own subscriptions" SELECT policy.

DROP POLICY IF EXISTS "Users insert own subscriptions" ON public.subscriptions;
DROP POLICY IF EXISTS "Users update own subscriptions" ON public.subscriptions;

-- The "Users read own subscriptions" SELECT policy is intentionally left in place.

-- ============================================================================
-- ROLLBACK (run these statements to undo this migration):
--
-- CREATE POLICY "Users insert own subscriptions" ON public.subscriptions
--   FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
--
-- CREATE POLICY "Users update own subscriptions" ON public.subscriptions
--   FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
-- ============================================================================
