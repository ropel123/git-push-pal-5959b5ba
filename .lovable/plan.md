## Problème

Actuellement, le bouton "Relancer scraping" boucle côté navigateur (`rescrapeScope` dans `Sourcing.tsx` lignes 454-505) et appelle `scrape-list` URL par URL avec concurrence 2. Si l'utilisateur quitte la page, la boucle s'arrête et les URLs restantes ne sont jamais retraitées.

## Solution

Déplacer l'orchestration côté serveur dans une nouvelle edge function `rescrape-batch` qui :
1. Reçoit le scope (`all` ou `{ platform }`)
2. Crée une ligne dans une nouvelle table `rescrape_jobs` (status, total, done, found, inserted, updated, errors, scope, started_at, finished_at)
3. Retourne immédiatement `202` avec le `job_id`
4. Lance le traitement en background via `EdgeRuntime.waitUntil(...)` — la boucle continue même si le client se déconnecte

La page `Sourcing.tsx` poll le job toutes les 2s tant qu'il existe un job actif, et affiche la progression comme aujourd'hui. Au rechargement de la page, si un job est encore en `running`, la barre de progression réapparaît automatiquement.

## Détails techniques

**Nouvelle table `rescrape_jobs`** (migration) :
- `id uuid pk`, `created_by uuid`, `scope jsonb`, `status text` (`running`/`done`/`failed`)
- `total int`, `done int`, `found int`, `inserted int`, `updated int`, `errors int`
- `started_at timestamptz`, `finished_at timestamptz`, `last_url text`
- RLS : admin only (via `has_role`)

**Nouvelle edge function `rescrape-batch`** (`supabase/functions/rescrape-batch/index.ts`) :
- Vérifie auth + rôle admin
- Charge `sourcing_urls` actives selon le scope
- Insère le job, retourne `{ job_id }` en 202
- `EdgeRuntime.waitUntil(runJob(job_id, urls))` qui boucle avec concurrence 2, appelle directement la logique `scrape-list` (ou l'invoque) et update le job après chaque URL

**Client `Sourcing.tsx`** :
- `rescrapeScope` n'appelle plus `scrape-list` en boucle, mais appelle `rescrape-batch` une seule fois
- Un `useEffect` cherche au mount un job `running` de l'utilisateur et lance le polling
- Polling toutes les 2s sur `rescrape_jobs` par `job_id`, met à jour `rescrapeProgress`, arrête quand `status !== 'running'`, toast final, `load()`

## Fichiers touchés

- nouveau : `supabase/migrations/<ts>_create_rescrape_jobs.sql`
- nouveau : `supabase/functions/rescrape-batch/index.ts`
- modifié : `supabase/config.toml` (déclaration de la fonction, `verify_jwt = true`)
- modifié : `src/pages/Sourcing.tsx` (remplacer `rescrapeScope` + ajouter polling + reprise au mount)
