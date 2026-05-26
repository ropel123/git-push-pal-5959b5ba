## Objectif

Permettre à l’utilisateur de **voir en direct ce que fait l’agent dans le navigateur** au lieu de lire uniquement les logs texte.

Browserbase fournit une URL de "Live View" intégrable en iframe pour chaque session. On va l’exposer et l’afficher dans l’app.

## Plan

### 1. Edge Function `fetch-dce-agent`

- Juste après `createBrowserbaseSession`, appeler `GET https://api.browserbase.com/v1/sessions/{id}/debug` pour récupérer `debuggerFullscreenUrl` (l’URL Live View embeddable).
- Mettre à jour la ligne `agent_runs` (déjà créée juste avant) avec un nouveau champ `live_view_url`.
- Logger un step `live_view.ready` avec l’URL pour fallback debug.

### 2. Migration Supabase

- Ajouter colonne `live_view_url text` à `agent_runs`.

### 3. Frontend — bouton DCE Agent (`DceAgentFetchButton.tsx`)

- Subscribe Supabase Realtime sur la ligne `agent_runs` du `run_id` retourné.
- Dès que `live_view_url` arrive (~2-3s après lancement), afficher un panneau "Voir l’agent en direct" avec :
  - une `iframe` plein cadre 16:9 pointant sur `live_view_url`,
  - un bouton "Ouvrir dans un nouvel onglet".
- Cacher le panneau quand le run passe en `success`, `no_files` ou `failed`.

### 4. Page `AgentMonitor`

- Dans la liste des runs `running`, ajouter un bouton "Voir live" qui ouvre `live_view_url` dans un nouvel onglet (déjà toute la plomberie Realtime existante).

## Résultat utilisateur

Quand on clique "Lancer l’agent IA", une fenêtre intégrée apparaît sous le bouton et montre en temps réel :
- la navigation MPI,
- le formulaire d’identité qui se remplit,
- le captcha qui se résout,
- le clic RETRAIT,
- la page des boutons Télécharger.

Plus besoin de deviner avec les logs.

## Détails techniques

- Endpoint Browserbase : `GET /v1/sessions/{id}/debug` retourne `{ debuggerFullscreenUrl, debuggerUrl, wsUrl, pages: [...] }`. On utilise `debuggerFullscreenUrl`.
- L’iframe nécessite que les cookies third-party soient autorisés. On ajoute `sandbox="allow-scripts allow-same-origin"` et un message d’aide si l’iframe reste vide.
- `live_view_url` expire avec la session Browserbase. On la nettoie en base à la fin du run (set NULL) — optionnel, mais évite de pointer sur une session morte.