## Diagnostic

Deux problèmes distincts dans les logs :

1. **CPU Time exceeded** après un download réussi
   - Les logs montrent `download_all_pieces — 5 pièce(s) téléchargée(s)` puis `wait_download OK`, puis `CPU Time exceeded` → `shutdown`.
   - L'agent a téléchargé les fichiers mais la fonction est tuée avant de répondre au frontend → le client reçoit 546 `WORKER_RESOURCE_LIMIT` alors que le travail est fait.
   - Cause probable : trop de travail synchrone après le download (uploads Supabase, mise à jour de `dce_uploads`, fermeture session Browserbase, analyse), tout cumulé dépasse les ~2s de CPU Time d'une edge function Supabase.

2. **Browserbase 402 — Free plan limit reached**
   - Le run d'après ne démarre même pas : quota mensuel Browserbase épuisé.
   - Sans upgrade ou nouveau compte, plus aucun run agent ne peut tourner.

## Plan d'action

### Étape A — Débloquer Browserbase (action utilisateur requise)
Tu dois faire l'un des deux :
- Upgrader le plan Browserbase sur https://browserbase.com/plans, ou
- Remplacer la clé `BROWSERBASE_API_KEY` par un autre compte/projet avec du quota.

Tant que ça n'est pas fait, l'agent ne peut plus s'exécuter du tout.

### Étape B — Corriger le `CPU Time exceeded` dans `fetch-dce-agent`
Découper la fin du run pour qu'elle ne consomme plus de CPU bloquant :

1. **Détacher les uploads et le bookkeeping** : dès qu'un fichier ZIP est récupéré depuis Browserbase, déplacer l'upload Storage + l'insert `dce_uploads` + la fermeture de session Browserbase dans `EdgeRuntime.waitUntil(...)`.
2. **Répondre immédiatement** au client avec `{ success: true, files_uploaded, run_id }` dès que les buffers sont en main (avant l'upload Storage), puis finir le travail en arrière-plan.
3. **Persister le statut final** dans `agent_runs` (déjà utilisé pour `live_view_url`) avec un champ `status` (`uploading` → `done` / `failed`) pour que `DceAgentFetchButton` puisse continuer à poller si besoin.
4. **Vérifier les boucles coûteuses** dans `cdp.eval` répétés (snapshots, retries) : limiter à 3 tentatives max sur la page de retrait et supprimer les `setTimeout` ≥ 15s qui empêchent la fonction de rendre la main.
5. **Ne pas relancer** d'analyse IA dans la même invocation : si une analyse doit suivre, l'enqueuer via une autre invocation `analyze-tender` au lieu de la chaîner.

### Étape C — Validation
- Vérifier dans les logs après un run que l'on voit `RESPONSE 200` avant `CPU Time` et pas l'inverse.
- Frontend : confirmer que le toast "DCE récupéré" s'affiche sans erreur 546.

## Détails techniques

- Fichier à modifier : `supabase/functions/fetch-dce-agent/index.ts`, fonction `runMain` autour de la ligne 1144 et fin du handler ligne 1816.
- Pattern `EdgeRuntime.waitUntil` : déjà documenté côté Supabase, dispo dans le runtime actuel.
- Pas de migration SQL nécessaire si on réutilise `agent_runs` ; sinon ajouter une colonne `status text` + `error_message text` via migration.

## Question

Veux-tu que :
- (a) je fasse uniquement le refactor CPU (Étape B) en attendant que tu débloques Browserbase, ou
- (b) j'ajoute aussi la colonne `status` à `agent_runs` et la logique de polling côté `DceAgentFetchButton` ?
