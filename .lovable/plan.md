

# Passer l'agent memoir sur OpenRouter

## Ce qui change

Modifier `supabase/functions/generate-memoir/index.ts` pour appeler l'API OpenRouter au lieu du gateway Lovable AI. OpenRouter est compatible avec l'API OpenAI, donc le streaming SSE et le tool calling `save_memoir` restent identiques.

## Prerequis

Tu devras fournir ta cle API OpenRouter. Tu peux la creer sur [openrouter.ai/keys](https://openrouter.ai/keys). Elle sera stockee comme secret Supabase `OPENROUTER_API_KEY`.

## Modifications

### 1. Ajouter le secret `OPENROUTER_API_KEY`

Via l'outil de gestion des secrets Supabase.

### 2. Modifier `supabase/functions/generate-memoir/index.ts`

- Remplacer l'URL `https://ai.gateway.lovable.dev/v1/chat/completions` par `https://openrouter.ai/api/v1/chat/completions`
- Remplacer `LOVABLE_API_KEY` par `OPENROUTER_API_KEY` dans le header Authorization
- Changer le modele vers `anthropic/claude-sonnet-4-20250514` (ou tout autre modele disponible sur OpenRouter — configurable)
- Enrichir le prompt systeme pour tirer parti de la puissance de Claude : sous-questions plus detaillees, minimum 12 echanges, relances systematiques
- Tout le reste (streaming SSE, tool calling `save_memoir`, sauvegarde profil) reste identique

### 3. Aucun changement UI

Le composant `MemoirAIChat.tsx` reste tel quel — seul le backend change.

## Cout

Facture par OpenRouter selon le modele choisi. Claude Sonnet ~$3/M tokens input, $15/M output. Une conversation memoir complete coute environ $0.05-0.15.

## Fichiers concernes

- `supabase/functions/generate-memoir/index.ts` — appel OpenRouter + prompt enrichi
- Secret `OPENROUTER_API_KEY` a ajouter

