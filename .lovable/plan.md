# Plan v3.6 — Rétro-enrichissement des consultations Atexo existantes

## Constat

Diagnostic en base (table `tenders`) :
- **1 051** consultations Atexo au total
- **815** ont un titre placeholder type `Consultation Atexo {id}`
- **841** sans `buyer_name`, **979** sans `deadline`
- Réparties sur ~20 hôtes (top : demat-ampa.fr, maximilien.fr, alsacemarchespublics, marchespublics596280…)

Le nouveau `atexoDetailParser.ts` (Plan v3.5) extrait titre/objet/acheteur/deadline depuis `/entreprise/consultation/{id}`. Il faut maintenant l'appliquer **une fois** sur l'historique.

## Approche

Nouvelle edge function **`atexo-backfill`** dédiée, appelable manuellement depuis l'admin (bouton) ou via curl. Elle traite les consultations placeholder par lots, en parallèle, avec budget temps.

### Fonctionnement

1. **Sélection** : query les `tenders` où `source_url LIKE '%/entreprise/consultation/%'` ET (`title LIKE 'Consultation Atexo%'` OR `buyer_name IS NULL` OR `deadline IS NULL`).
2. **Groupement par host** pour réutiliser une session PRADO (PHPSESSID) par domaine → moins de cold-starts.
3. **Pool concurrent** (6 fetches parallèles, identique à v3.5) avec budget 50s par invocation.
4. **Parsing** via `atexoDetailParser.fetchAtexoDetail()` (déjà existant).
5. **UPDATE** des champs `title`, `object`, `buyer_name`, `reference`, `deadline`, `publication_date`, `cpv_codes`, `enriched_data.backfilled_at`.
6. **Reprise** : pas de cursor en base, le filtre WHERE suffit (un item enrichi sort naturellement du set).

### Volume & exécutions

~815 items à traiter. Avec ~150 items/run (60s, pool 6, latence ~2s/page) → **~6 invocations** pour finir. La fonction renvoie `{ processed, updated, failed, remaining }` pour pouvoir relancer en boucle depuis l'UI.

### UI Admin

Petit bouton "Rétro-enrichir Atexo" sur la page Sourcing (admin) qui :
- affiche le `remaining` actuel
- relance la fonction tant que `remaining > 0`
- montre une barre de progression simple

## Changements

### Edge function (nouveau)
- **`supabase/functions/atexo-backfill/index.ts`** : 
  - Sélectionne le batch via service role
  - Réutilise `fetchAtexoDetail` + `fetchWithCookies` du shared
  - UPDATE direct sur `tenders` (admin/service role)
  - Logs `[atexo:backfill] host=X processed=N updated=N failed=N elapsed=Xms`

### Migration
- Aucune (UPDATE de données existantes, schéma inchangé)

### Frontend
- **`src/pages/Sourcing.tsx`** (ou page admin équivalente) : bouton + état de progression appelant la fonction via `supabase.functions.invoke('atexo-backfill')` en boucle jusqu'à `remaining=0`.

### Telemetry
- Insertion dans `scrape_logs` avec `source='atexo_backfill'` pour traçabilité.

## Ce que ça donne après

Les 815 consultations placeholder auront leurs vrais titres, acheteurs, dates → scoring/filtres/recherche fonctionneront enfin sur l'historique Atexo. Opération one-shot, ~5 min de clics.

## Hors scope

- Ré-enrichissement des autres plateformes (Place, MPE custom…) : à voir séparément si besoin.
- Suppression des placeholder qui resteraient en échec après N tentatives : à décider après le run.
