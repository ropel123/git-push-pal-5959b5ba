CREATE TABLE public.buyer_follows (id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY, user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, buyer_name TEXT NOT NULL, buyer_siret TEXT, created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), UNIQUE(user_id, buyer_name));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.buyer_follows TO authenticated;
GRANT ALL ON public.buyer_follows TO service_role;
ALTER TABLE public.buyer_follows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own buyer follows" ON public.buyer_follows FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_buyer_follows_user ON public.buyer_follows(user_id);