

# Audit complet TED API — Extraction maximale des donnees

## Build error a corriger d'abord

Le fichier `sparkles.tsx` importe `@tsparticles/react` qui n'est pas installe. Il faut ajouter ce package aux dependances.

## Etat actuel du scraper TED

Le scraper ne demande que **12 champs** a l'API TED v3 sur les **60+ disponibles**. Voici ce qui manque :

```text
Donnee                    | Champ API TED                          | Base actuelle
--------------------------|----------------------------------------|---------------
Type d'avis               | form-type                              | hardcode "open"
Email acheteur            | buyer-email                            | null
Tel acheteur              | buyer-phone                            | null
Rue acheteur              | buyer-street-address                   | absent
Code postal acheteur      | buyer-postal-code                      | absent
Site web acheteur         | buyer-url                              | absent
Code NUTS                 | place-of-performance-country-sub       | null
Criteres attribution      | award-criterion-name-lot               | null
Poids criteres            | award-criterion-number-weight-lot      | null
Type critere selection    | selection-criteria-type-lot             | null
Desc critere selection    | selection-criteria-description-lot     | null
Desc courte procedure     | short-description                      | absent
Info complementaire lot   | additional-information-lot             | null
Duree contrat             | duration-lot                           | absent
Accord-cadre              | framework-agreement-lot                | absent
Nombre offres recues      | received-submissions-count             | absent
Gagnant                   | winner-chosen-lot                      | absent
Nom gagnant (org)         | winner-name (via org references)       | absent
Valeur attribuee          | contract-value                         | absent
Type contrat normalise    | contract-nature                        | "works" (non traduit)
```

## Corrections prevues

### 1. Fix build : ajouter `@tsparticles/react`

Ajouter le package manquant aux dependances.

### 2. `scrape-ted/index.ts` — Enrichir les champs API

Passer de 12 a ~25 champs dans le `fields` array :
```
"form-type", "buyer-email", "buyer-phone", "buyer-street-address",
"buyer-postal-code", "buyer-url", "place-of-performance-country-sub",
"award-criterion-name-lot", "award-criterion-number-weight-lot",
"selection-criteria-type-lot", "selection-criteria-description-lot",
"short-description", "additional-information-lot", "duration-lot",
"framework-agreement-lot", "received-submissions-count",
"winner-chosen-lot", "contract-value"
```

### 3. Status dynamique

Mapper `form-type` :
- "Result" / "contract-award" → `"awarded"`
- "Competition" / "contract-notice" → `"open"`
- "Change" → `"open"` (rectificatif)
- Defaut → `"open"`

### 4. NUTS → region + execution_location

Mapper les prefixes NUTS vers les regions francaises :
```
FRB → Centre-Val de Loire, FRC → Bourgogne-FC, FRD → Normandie,
FRE → Hauts-de-France, FRF → Grand Est, FRG → Pays de la Loire,
FRH → Bretagne, FRI → Nouvelle-Aquitaine, FRJ → Occitanie,
FRK → Auvergne-Rhone-Alpes, FRL → PACA, FRM → Corse,
FR1 → Ile-de-France, FRZZ → France (non specifie)
```
Stocker le code NUTS dans `nuts_code`, la region dans `region`, et garder la ville dans `execution_location`.

### 5. Criteres d'attribution structures

Combiner `award-criterion-name-lot` + `award-criterion-number-weight-lot` en texte lisible :
```
"Valeur technique : 45%\nPrix : 40%\nEnvironnement : 15%"
```

### 6. Conditions de participation

Combiner `selection-criteria-type-lot` + `selection-criteria-description-lot`.

### 7. Contact acheteur complet

Ajouter email, tel, url au `buyer_contact`. Construire `buyer_address` avec rue + CP + ville + pays.

### 8. Description enrichie

Prefixer `short-description` (description procedure) avant `description-lot`.

### 9. contract_type normalise

Mapper : `"works"` → `"Travaux"`, `"services"` → `"Services"`, `"supplies"` → `"Fournitures"`.

### 10. Award notices pour les avis d'attribution

Quand `form-type` = "Result" :
- Creer une entree `award_notices` avec winner_name, awarded_amount, num_candidates
- Mettre le tender en status `"awarded"`

### 11. Informations complementaires

Extraire `additional-information-lot`, `duration-lot`, `framework-agreement-lot` et les stocker dans `additional_info` ou `lots`.

## Fichiers modifies

- `package.json` : ajouter `@tsparticles/react`
- `supabase/functions/scrape-ted/index.ts` : refonte complete du parsing

## Post-deploiement

Redeployer et re-executer le scraper TED pour corriger toutes les AO TED existantes.

