
Objectif: corriger le 500 sur `generate-memoir` sans toucher à l’UI.

Constat confirmé
- La cause est déjà visible dans les logs Edge Function :
  `AI error: 404 {"error":{"message":"No endpoints found for anthropic/claude-3-5-sonnet-20241022.","code":404}}`
- Le code actuel utilise encore ce modèle dans `supabase/functions/generate-memoir/index.ts` ligne ~175.
- Comme `OPENROUTER_API_KEY` est bien configurée, la branche OpenRouter est toujours prise, donc le fallback Lovable n’est jamais utilisé.

Plan de correction
1. Corriger le modèle OpenRouter
- Remplacer `anthropic/claude-3-5-sonnet-20241022` par un identifiant OpenRouter valide et actuellement supporté.
- Éviter les IDs “supposés” ou datés sans vérification.

2. Rendre l’erreur explicite côté backend
- Ajouter une gestion dédiée pour les erreurs `404` OpenRouter.
- Retourner une erreur claire du type :
  - `Model OpenRouter introuvable`
  - et inclure si possible le message provider pour éviter le faux diagnostic “Erreur IA” générique.
- Garder aussi les cas `402` et `429` déjà présents.

3. Ajouter un vrai fallback runtime
- Si OpenRouter répond `404`, `400` ou autre erreur non récupérable liée au modèle/provider, basculer automatiquement sur `LOVABLE_API_KEY` avec un modèle Lovable AI stable.
- Cela évite qu’un mauvais slug casse tout le chat.
- Le fallback ne doit pas dépendre de l’absence de secret, mais aussi de l’échec de l’appel OpenRouter.

4. Ne pas changer le contrat frontend
- Garder le streaming SSE tel quel dans `MemoirAIChat.tsx`.
- Garder le format `tools` / `tool_calls` pour `save_memoir`.
- Aucune modification UX nécessaire pour corriger ce bug.

5. Améliorer l’observabilité
- Logger clairement :
  - provider utilisé (`openrouter` ou `lovable`)
  - modèle tenté
  - code HTTP retourné
- Sans exposer les secrets.
- Cela permettra de diagnostiquer immédiatement un prochain incident.

Validation prévue
- Ouvrir le chat mémoire et vérifier que le premier message assistant arrive sans 500.
- Vérifier que le streaming fonctionne toujours token par token.
- Vérifier qu’un `tool_call` éventuel est toujours parsé côté client.
- Vérifier qu’en cas d’échec OpenRouter, le fallback Lovable AI répond bien.

Détails techniques
- Fichier principal à modifier : `supabase/functions/generate-memoir/index.ts`
- Le frontend `src/components/MemoirAIChat.tsx` semble correct pour lire un flux SSE OpenAI-compatible.
- `supabase/config.toml` ne montre pas d’entrée spécifique pour `generate-memoir`, mais ce n’est pas la cause du bug actuel.
- Le problème n’est pas l’auth, ni CORS, ni le parsing client : le backend reçoit un `404 model not found` du provider.

Résultat attendu
- Plus de `500 {"error":"Erreur IA"}` au lancement du chat.
- Le chat mémoire fonctionne via OpenRouter si le modèle est valide.
- Si OpenRouter casse ou change de slug, l’app continue à fonctionner grâce au fallback.
