-- Migration : zéro dépendance Lovable côté IA.
-- Tous les appels LLM passent désormais par OpenRouter ; le provider logique
-- "lovable" (Lovable AI Gateway) disparaît. On bascule les configs existantes :
--   provider / fallback_provider  'lovable'  →  'openrouter'
--   modèle 'google/gemini-3-flash-preview'   →  'google/gemini-2.5-flash'
--   (id non garanti chez OpenRouter → on retombe sur un id stable équivalent)

UPDATE public.ai_prompts
SET provider = 'openrouter'
WHERE provider = 'lovable';

UPDATE public.ai_prompts
SET fallback_provider = 'openrouter'
WHERE fallback_provider = 'lovable';

UPDATE public.ai_prompts
SET model = 'google/gemini-2.5-flash'
WHERE model = 'google/gemini-3-flash-preview';

UPDATE public.ai_prompts
SET fallback_model = 'google/gemini-2.5-flash'
WHERE fallback_model = 'google/gemini-3-flash-preview';
