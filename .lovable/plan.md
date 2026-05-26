# Tender MPI/SIAAP vide : 2 problèmes à corriger

## Constat

Le tender `c749e60e-…` (SIAAP, source `scrape:mpi`) en base contient :
- ✅ titre, buyer_name, reference
- ❌ `dce_url`, `source_url`, `description`, `deadline`, `publication_date`, `procedure_type`, `estimated_amount`, `cpv_codes`, `lots` → tous null/vides
- `enriched_data.raw._source_url` = `https://marchespublics.siaap.fr/avis/index.cfm?fuseaction=pub.affResultats` (= la **page liste**, pas la fiche détail)
- `enriched_data.item_link_rejected_reason` est présent → le scraper a tenté de suivre un lien détail mais l'a rejeté.

### Cause racine n°1 — Le scraper ne va jamais sur la fiche détail

- Le playbook DB `mpi` a `url_pattern = marches-publics\.info` → **il ne matche pas** `marchespublics.siaap.fr` (sous-domaine acheteur custom du même éditeur).
- Sans playbook reconnu, `scrape-list` retombe sur la stratégie "template" qui se limite à la page liste, ou la stratégie hybride filtre les liens détail avec un regex (`/detail|consultation|refConsult|…/i`) qui ne matche pas le pattern SIAAP (`fuseaction=pub.dspAvisDetail&refConsult=…` devrait pourtant matcher → à vérifier dans les logs).
- Conséquence : titre récupéré sur la liste, mais aucun fetch de la fiche → aucune des données riches.

### Cause racine n°2 — L'UI n'a aucun fallback

`TenderDetail.tsx` ligne 193 :
```ts
const officialUrl = (source_url ok ? source_url : null) || (dce_url ok ? dce_url : null);
```
Quand les deux sont null, le bouton "Voir l'avis original" disparaît, même si on a `enriched_data.listing_url` ou `enriched_data.raw._source_url` exploitables.

## Plan

### 1. Fix UI — fallback immédiat (visible aujourd'hui)

`src/pages/TenderDetail.tsx`
- Étendre la cascade `officialUrl` pour inclure `enriched_data.listing_url`, `enriched_data.raw._source_url` en dernier recours.
- Quand on tombe sur un `listing_url` (page de résultats), libeller le bouton **"Voir sur la plateforme acheteur"** (au lieu de "Voir l'avis original") pour ne pas mentir.
- Quand aucune `description` n'est disponible, afficher un encart neutre "Données non récupérées — voir la fiche sur la plateforme" pointant vers le même URL, plutôt qu'un bloc vide.

Pas de changement business logic. Juste un fallback de présentation.

### 2. Fix scraper — couvrir les sous-domaines MPI custom

`agent_playbooks` (migration)
- Élargir `url_pattern` du playbook `mpi` de `marches-publics\.info` à `marches-publics\.info|marchespublics\.[a-z0-9-]+\.(fr|com)` (couvre `marchespublics.siaap.fr`, `marchespublics.cdc.fr`, etc., tous propulsés par AWS Achat / MPI).
- Vérifier que `list_strategy = 'hybrid'` (pour forcer le fetch des fiches détail) — sinon le mettre à `hybrid`.

`supabase/functions/_shared/playbookExecutor.ts`
- Élargir le regex de sélection des liens détail à `/detail|consultation|refConsult|refPub|idCons|annonce|dspAvisDetail|orgAcronyme/i` (le pattern SIAAP utilise `dspAvisDetail`).
- Logger explicitement les `item_link_rejected_reason` pour diagnostiquer les futurs cas.

### 3. Backfill du tender existant

Edge function one-shot `enrich-tender-mpi` (ou simple appel à `scrape-list` en mode détail sur l'URL de fiche) qui :
1. Prend `tender_id` en input
2. Lit `enriched_data.listing_url`
3. Fait un Firecrawl scrape ciblé pour retrouver le lien fiche correspondant au `reference = 20260101`
4. Extrait `dce_url`, `description`, `deadline`, `publication_date`, `procedure_type` via le parseur MPI existant
5. UPDATE la ligne `tenders`

Alternative plus simple : si on connaît l'URL de fiche manuellement, on peut faire un UPDATE direct via migration (l'utilisateur peut la coller en chat).

## Ordre d'exécution proposé

1. **(rapide)** Fix UI fallback → l'utilisateur voit immédiatement un lien utile sur ce tender et tous les autres "vides".
2. **(structurel)** Migration playbook MPI + regex executor → les futurs scrapes SIAAP seront enrichis.
3. **(optionnel)** Backfill du tender courant via re-scrape ciblé.

## Question pour décider

Veux-tu que je fasse les 3 d'un coup, ou commencer juste par le fix UI (1) pour débloquer la vue tout de suite, puis enchaîner sur le scraper après validation ?
