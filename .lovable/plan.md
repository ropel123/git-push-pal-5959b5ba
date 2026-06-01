## Problème

L’agent passe en mode background : il répond immédiatement `{ success: true, files_uploaded: 0, background: true }` au frontend, pendant qu’il finit le téléchargement et l’upload en `EdgeRuntime.waitUntil`. Le bouton lit `files_uploaded === 0` et affiche “Aucun fichier”, même si le ZIP arrive ensuite (status `success`, `files_downloaded=1` côté `agent_runs`).

## Correctif

Dans `src/components/DceAgentFetchButton.tsx` :

1. Détecter `data.background === true` dans la réponse de `invoke`.
2. Au lieu de figer `status` à `success`/`no_files`, garder `running` et poller `agent_runs` par `runId` (le hook existant poll déjà `live_view_url`, on étend le tick pour lire aussi `status`, `files_downloaded`, `duration_ms`, `cost_usd`, `captchas_solved`, `error_message`).
3. Quand `agent_runs.status` devient :
   - `success` → bouton `success`, message “N fichier(s) récupéré(s) — …”.
   - `no_files` → bouton `no_files`, message “aucun fichier téléchargé”.
   - `failed`/`timeout` → bouton `failed`, message = `error_message`.
4. Garder le comportement actuel quand `background` est absent (compat).

Aucune autre modification (pas de backend, pas de DB). Validation : relancer l’agent et vérifier que le bouton bascule de “Agent en cours…” à “DCE récupéré” quelques secondes après la fin du run.