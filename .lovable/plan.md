## Problème identifié

Le moteur PRADO marche parfaitement (90 IDs uniques, 0 doublon, PRADO_PAGESTATE tourne à chaque page, status 200 partout). Le seul problème : un **plafond codé en dur** dans `atexoExecutor.ts` :

```ts
const MAX_PAGES_PER_RUN = 8;
// → page initiale + 8 paginations = 9 pages max
```

Résultat observé sur les 18-20 pages disponibles :
- `marchespublics596280` : 90/200 (9 pages / 20) — `stopped_by: max_pages`
- `alsacemarchespublics` : 30/180 (3 pages / 18)
- `meuse` : même cause attendue

## Solution

### 1. Augmenter `MAX_PAGES_PER_RUN` à 25
- Couvre 99% des plateformes Atexo (la plupart ont 5-20 pages)
- 25 pages × ~10 items = jusqu'à 250 consultations par run
- À ~1s par page POST, run total < 30s (largement sous le timeout edge function de 150s)

### 2. Ajouter un mode "full sweep" déclenché par `total_pages_detected`
- Si `totalPages <= 30` détecté en page 1 → on scrape tout (`pagesToFetch = totalPages - 1`)
- Si `totalPages > 30` → on plafonne à 25 et on log `stopped_by: max_pages` (rare, plateformes nationales type UGAP)
- Évite de gaspiller des cycles sur les petites plateformes (2-5 pages) ET d'en perdre sur les moyennes (15-20 pages)

### 3. Garde-fous additionnels
- **Budget temps** : si `Date.now() - startTime > 90_000` ms → stop avec `stopped_by: time_budget`
- **Stagnation** : si 2 pages consécutives donnent 0 nouveau ID → stop avec `stopped_by: no_new_items` (déjà en place, conservé)
- **Erreurs HTTP** : si 2 POST consécutifs renvoient status != 200 → stop avec `stopped_by: http_error`

### 4. Logs enrichis
Ajouter dans `_atexo_stats` :
- `max_pages_cap` (la limite effective utilisée pour ce run)
- `time_elapsed_ms`
- `stop_reason_detail` (ex: "totalPages=18 ≤ cap=25, full sweep")

## Fichier modifié

- `supabase/functions/_shared/atexoExecutor.ts` :
  - L46 : `MAX_PAGES_PER_RUN = 25`
  - L305 : logique `pagesToFetch` adaptative selon `totalPages`
  - Ajout du budget temps + détection erreurs HTTP consécutives
  - Enrichissement des stats retournées

## Résultat attendu pour Alsace (18 pages)

```
pages_scraped: 18
unique_consultations: ~180
stopped_by: total_pages_reached
coverage_ratio: 1.0
```

Aucun changement côté DB, côté frontend, ni côté `pradoClient.ts`.