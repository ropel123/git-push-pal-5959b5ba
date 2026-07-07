-- Persistance des conversations de l'assistant mémoire technique (onboarding + dialog).
-- Une conversation active par utilisateur et par mode ; reprise après refresh.
-- Idempotent : sûr à ré-appliquer.

CREATE TABLE IF NOT EXISTS public.memoir_conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mode TEXT NOT NULL DEFAULT 'onboarding' CHECK (mode IN ('onboarding', 'dialog')),
  messages JSONB NOT NULL DEFAULT '[]'::jsonb,
  memoir_draft JSONB,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'abandoned')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.memoir_conversations TO authenticated;
GRANT ALL ON public.memoir_conversations TO service_role;

ALTER TABLE public.memoir_conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own memoir conversations" ON public.memoir_conversations;
CREATE POLICY "Users read own memoir conversations" ON public.memoir_conversations
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users insert own memoir conversations" ON public.memoir_conversations;
CREATE POLICY "Users insert own memoir conversations" ON public.memoir_conversations
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users update own memoir conversations" ON public.memoir_conversations;
CREATE POLICY "Users update own memoir conversations" ON public.memoir_conversations
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users delete own memoir conversations" ON public.memoir_conversations;
CREATE POLICY "Users delete own memoir conversations" ON public.memoir_conversations
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_memoir_conversations_user ON public.memoir_conversations(user_id, status);

-- Une seule conversation active par utilisateur et par mode.
CREATE UNIQUE INDEX IF NOT EXISTS idx_memoir_conversations_active
  ON public.memoir_conversations(user_id, mode)
  WHERE status = 'active';

DROP TRIGGER IF EXISTS update_memoir_conversations_updated_at ON public.memoir_conversations;
CREATE TRIGGER update_memoir_conversations_updated_at
  BEFORE UPDATE ON public.memoir_conversations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
