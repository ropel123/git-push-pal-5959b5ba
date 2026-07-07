
## Diagnostic

Ta base de données a perdu plusieurs tables (probablement supprimées via SQL Editor). Il manque aujourd'hui dans `public` :

- `sourcing_urls` — **la liste maîtresse des URLs à scraper** (BOAMP, TED, plateformes acheteurs)
- `sourcing_seen_urls` — cache anti-doublons
- `scrape_logs` — journal des scrapes
- `ai_prompts`, `ai_prompt_versions` — prompts éditables
- `ai_request_log` — rate limiting IA
- `memoir_conversations` — conversations mémoire technique

Résultat : `fetch-boamp`, `sourcing-scheduler`, `scrape-awards-list`, `reclassify-sourcing-urls`, la page Sourcing et le panneau plateformes ne peuvent plus rien lire ni écrire.

## Comment on faisait avant

Il n'y a **jamais eu de "liste d'URLs BOAMP/TED"** au sens catalogue :

- **BOAMP** : une seule ligne dans `sourcing_urls` avec l'URL clé `https://www.boamp.fr/api/explore/v2.1/catalog/datasets/boamp`. La fonction `fetch-boamp` interroge l'**API BOAMP** (opendata) directement, paginée par tranches de 100, et upsert dans `tenders`. Cette ligne ne sert qu'à afficher un statut (dernier run, succès/erreur) dans le panneau plateformes.
- **TED** : pareil côté ingestion — la fonction `reparse-ted-awards` (que tu as aussi supprimée) tapait l'**API TED v3** directement pour récupérer les XML puis parsait via `parseBoampAward`. Aucune URL TED n'a jamais été seedée dans `sourcing_urls`.
- **Plateformes acheteurs** (Maximilien, PLACE, MPI, AMP, Nantes, AuRA, Ternum, Alsace, Pays de Loire, Haute-Garonne) : **10 URLs seedées** dans `sourcing_urls`, scrapées via Firecrawl par `scrape-list`, orchestrées par `sourcing-scheduler`.

## Plan de restauration

### 1. Restaurer le schéma manquant (une migration)

Recréer à l'identique des migrations d'origine :

- `sourcing_urls` (colonnes + `kind` tender/award + RLS admin + trigger updated_at + index actif/due + GRANT service_role)
- `sourcing_seen_urls`
- `scrape_logs` (avec `sourcing_url_id`, `items_updated`, `items_skipped`, `metadata`)
- `ai_prompts` + `ai_prompt_versions` (RLS admin, trigger updated_at)
- `ai_request_log` (service_role only)
- `memoir_conversations` (RLS user-scoped, index actif par mode)

FK vers `sourcing_urls` restaurées : `agent_playbooks.sourcing_url_id`, `award_notices.sourcing_url_id` existent déjà comme colonnes libres — les recontraindre.

### 2. Reseeder `sourcing_urls`

- **10 plateformes acheteurs** (kind='tender') identiques au seed d'origine `20260421151644` :
  Maximilien, APProch/PLACE, Ternum, Grand Est, Alsace, AMP Métropole, Nantes Métropole, AuRA, Pays de Loire, Haute-Garonne.
- **1 ligne BOAMP** (kind='tender', platform='boamp', parser_type='api') avec l'URL clé attendue par `fetch-boamp/index.ts`.

Pas de ligne TED côté sourcing (respect de la contrainte data : TED autorisé uniquement pour les avis d'attribution, ingérés via l'API TED, pas via `sourcing_urls`).

### 3. Restaurer la fonction `reparse-ted-awards`

Recréer `supabase/functions/reparse-ted-awards/index.ts` (celle qui enrichissait les 1660 anciennes attributions TED via l'API TED v3 + `parseBoampAward`). Ajouter `verify_jwt = false` dans `config.toml`.

### 4. Reseeder les prompts IA

Ré-insérer `generate-memoir`, `analyze-tender.quick`, `analyze-tender.technical`, `generate-pricing-strategy`, `generate-tender-document` (les prompts qu'on avait seedés dans les migrations `20260707102000` et suivantes).

### 5. Vérifications

- Ouvrir /sourcing (admin) → 11 lignes visibles, toutes en statut vide.
- Déclencher `fetch-boamp?days=7` → la ligne BOAMP se met à jour, des tenders arrivent.
- Déclencher `sourcing-scheduler` → les 10 plateformes tournent.
- Le panneau plateformes de /tenders réaffiche les statuts.

## À confirmer avant que je lance

1. Tu veux bien qu'on **recrée à l'identique** les tables perdues (schéma des migrations d'origine, sans données) ?
2. Tu veux le **même set de 10 plateformes** qu'à l'origine, ou tu as retiré/ajouté des acheteurs entre temps ?
3. Je restaure aussi `reparse-ted-awards` (utile pour enrichir les 1400 attributions TED restantes) ?

Une fois confirmé, je passe en build et j'enchaîne migration + seed + fonction + config.

## Détails techniques

- Fichier `supabase/functions/fetch-boamp/index.ts` attend exactement `SOURCING_URL_KEY = "https://www.boamp.fr/api/explore/v2.1/catalog/datasets/boamp"` — la ligne BOAMP doit avoir ce `url` exact.
- Les GRANT à inclure : `GRANT ALL ON public.sourcing_urls TO service_role;` (les edge functions passent en service role), pas de grant `authenticated` — accès via RLS admin uniquement, cohérent avec les autres tables admin.
- Aucune data utilisateur perdue n'est récupérable (tenders/awards déjà présents, c'est juste le pilotage du scraping qui est cassé).

