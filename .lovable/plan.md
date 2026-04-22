

# Arrêt complet du sourcing TED + BOAMP

## Objectif

Arrêter immédiatement toute ingestion provenant de TED et BOAMP, supprimer les 634 AO déjà collectés depuis ces deux sources, et garder uniquement les AO scrapés depuis les vraies plateformes acheteur (PLACE, Atexo, MPI, SafeTender).

## Constat

- `boamp` : 334 AO en base
- `ted` : 300 AO en base
- Soit **634 AO à supprimer**
- Restant après nettoyage : ~100 AO scrapés (atexo 55, mpi 33, safetender 10, place 2)

## Plan d'action

### Étape 1 — Suppression des données TED + BOAMP (migration)

Migration SQL qui :

- supprime en cascade logique les enregistrements liés aux AO `boamp` et `ted` :
  - `pipeline_items` (référencent `tender_id`)
  - `pipeline_comments` (via `pipeline_item_id`)
  - `dce_uploads` / `dce_downloads`
  - `tender_analyses`
  - `agent_runs`
  - `award_notices`
- supprime ensuite les AO eux-mêmes : `DELETE FROM tenders WHERE source IN ('boamp', 'ted')`
- nettoie aussi les `scrape_logs` correspondants
- nettoie les `ingest_cursors` liés à ces sources

### Étape 2 — Désactivation du sourcing dans le code

#### 2.1 — Edge function `sourcing-scheduler`

Identifier et désactiver tout appel automatique à BOAMP / TED :

- supprimer les blocs d'ingestion BOAMP API v2.1
- supprimer les blocs d'ingestion TED API v3.0
- garder uniquement le scraping des plateformes acheteur via `scrape-list`

#### 2.2 — Tables `sourcing_urls`

Désactiver (`is_active = false`) toutes les entrées dont l'URL pointe vers `boamp.fr` ou `ted.europa.eu` (au cas où il y en aurait).

#### 2.3 — Front

Retirer de l'UI toute référence aux sources `boamp` / `ted` :

- filtres dans `Tenders.tsx`
- éventuels affichages dans `Dashboard.tsx`, `AgentMonitor.tsx`, `Sourcing.tsx`
- supprimer les badges "BOAMP" / "TED" dans les listes

### Étape 3 — Garde-fou côté ingestion

Dans `supabase/functions/upsert-tenders/index.ts` et tout autre endroit qui insère :

- rejet explicite si `source` ∈ `{'boamp', 'ted'}`
- log silencieux pour éviter de réintroduire ces sources par erreur

### Étape 4 — Nettoyage mémoire projet

Mettre à jour `mem://fonctionnalites/sources-donnees` pour refléter la nouvelle stratégie : uniquement scraping direct des plateformes acheteur, plus d'agrégation BOAMP/TED.

## Fichiers concernés

```text
supabase/migrations/<ts>_remove_ted_boamp.sql       ← suppression cascade
supabase/functions/sourcing-scheduler/index.ts      ← retrait BOAMP + TED
supabase/functions/upsert-tenders/index.ts          ← garde-fou anti-source
src/pages/Tenders.tsx                               ← retrait filtres BOAMP/TED
src/pages/Dashboard.tsx                             ← retrait stats BOAMP/TED
src/pages/AgentMonitor.tsx                          ← idem si présent
src/pages/Sourcing.tsx                              ← idem si présent
mem://fonctionnalites/sources-donnees               ← MAJ stratégie data
```

## Effet attendu

- Plus aucun appel à BOAMP API ou TED API.
- Les 634 AO TED/BOAMP disparaissent de la liste.
- La plateforme ne montre plus que les AO directement scrapés depuis les plateformes acheteur (donc avec un vrai `dce_url` exploitable).
- Aucun nouvel AO `boamp` / `ted` ne pourra être inséré, même par erreur.

## Détail technique

Ordre de suppression imposé par les références logiques (pas de FK déclarée mais tables liées) :

```text
pipeline_comments
  └─ pipeline_items
       └─ tender_id

dce_uploads / dce_downloads / tender_analyses / agent_runs / award_notices
  └─ tender_id

tenders (boamp + ted) ← dernière étape
```

La migration utilisera des `DELETE … WHERE tender_id IN (SELECT id FROM tenders WHERE source IN ('boamp','ted'))` pour chaque table dépendante avant le `DELETE FROM tenders`.

