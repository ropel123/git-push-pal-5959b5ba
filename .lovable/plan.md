# Sourcing scindé : AO + Avis d'attribution

Diviser la zone Sourcing en deux sections indépendantes, chacune avec sa propre liste d'URLs et son propre agent de scraping. Les Avis d'attribution récupérés enrichissent la table `award_notices` existante et sont rattachés aux `tenders` quand un match est trouvé (sinon stockés tels quels).

## 1. Base de données

Migration unique :

- Ajouter `sourcing_urls.kind text NOT NULL DEFAULT 'tender'` avec contrainte `CHECK (kind IN ('tender','award'))`. Toutes les URLs existantes deviennent `tender`.
- Ajouter les colonnes manquantes sur `award_notices` pour stocker un avis brut non encore rattaché :
  - `buyer_name text`, `buyer_siret text`
  - `title text`, `reference text`
  - `source text`, `source_url text`, `sourcing_url_id uuid`
  - `raw jsonb DEFAULT '{}'`
  - Rendre `tender_id` nullable (déjà le cas).
- Index `award_notices(sourcing_url_id)`, `award_notices(reference)`, `award_notices(buyer_siret)`.
- GRANT/RLS : ajouter `INSERT/UPDATE` pour `service_role` (les edge functions écrivent), garder `SELECT` authenticated existant.

## 2. Edge functions

Refactor minimal, on duplique la chaîne existante au lieu de la complexifier :

- `scrape-list` : ajouter un champ `kind` au log et passer le `kind` de la sourcing_url au playbook executor (info uniquement, pas de changement de logique de parsing pour `tender`).
- Nouvelle fonction `scrape-awards-list` : même squelette que `scrape-list` mais sortie typée "avis d'attribution" → insère dans `award_notices` (matching `tender_id` par `reference` + `buyer_siret` si trouvé). Réutilise `playbookExecutor` / `atexoExecutor` avec un mode `AWARD`.
- `sourcing-scheduler` : filtrer `sourcing_urls` par `kind` et router :
  - `kind='tender'` → `scrape-list`
  - `kind='award'` → `scrape-awards-list`
- Ajouter dans `_shared/playbookExecutor.ts` un paramètre `kind` pour adapter les sélecteurs/heuristiques aux pages de type "avis" (numéro de marché, attributaire, montant, date d'attribution).

## 3. UI Sourcing

`src/pages/Sourcing.tsx` réorganisé avec deux onglets en haut :

- **Onglet "Appels d'offres"** : liste filtrée `kind='tender'` + bouton "Ajouter une URL AO".
- **Onglet "Avis d'attribution"** : liste filtrée `kind='award'` + bouton "Ajouter une URL Avis".

Chaque onglet réutilise le même tableau (filtres, logs, test, edit, run) ; seule la valeur de `kind` change à la création/au filtrage. Le formulaire d'ajout reçoit `kind` en prop. Les compteurs et badges affichent le total par section.

Le panneau "Logs" en bas affiche aussi le `kind` de chaque run.

## 4. Hook & types

- `useSourcingAdmin` : étendre `SourcingUrl` avec `kind`, accepter un filtre `kind` optionnel.
- Helpers `useTenderSourcingUrls()` / `useAwardSourcingUrls()` pour l'UI.

## Détails techniques

```text
sourcing_urls
  kind tender|award (NEW)

award_notices (extended)
  + buyer_name, buyer_siret, title, reference,
    source, source_url, sourcing_url_id, raw
  tender_id nullable (matching post-insert)

scheduler ──► kind=tender ──► scrape-list ──► tenders
            └─ kind=award  ──► scrape-awards-list ──► award_notices
                                                       └─ match by reference+siret → set tender_id
```

## Hors scope

- Aucune modification du parser HTML/PRADO existant pour les AO (comportement strictement identique).
- Pas d'UI publique côté utilisateur final (la page reste admin).
- Pas de migration des URLs existantes vers `kind='award'` — c'est à l'admin de les créer.