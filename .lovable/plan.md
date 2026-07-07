## Diagnostic

D'après les données :
- 2065 notices TED en base
- Seules **405** (celles ingérées aujourd'hui 10/06) ont été parsées par la version actuelle du parser eForms → 320 ont `award_criteria`, 323 ont `offers_received`, 324 ont `winner_address`
- Les **1660 notices plus anciennes** ont leur `raw` (XML déjà parsé en JSON) stocké en base, mais les champs avancés sont vides parce qu'elles ont été ingérées **avant** que `parseBoampAward` gère correctement le format TED

Aucun bug actuel à corriger dans le parser. Il faut juste **rejouer le parser sur le `raw` déjà stocké** pour les anciennes notices — pas besoin de retaper l'API TED.

## Plan

### 1. Nouvelle edge function `reparse-ted-awards`
- Sélectionne par lots (200) les `award_notices` où `source = 'TED'`, `raw IS NOT NULL`, et au moins un champ avancé manquant (`award_criteria IS NULL AND offers_received IS NULL AND winner_address IS NULL`)
- Pour chaque ligne :
  - Wrap : `{ EFORMS: { ContractAwardNotice: raw.ContractAwardNotice } }`
  - Appelle `parseBoampAward` (déjà partagé dans `_shared/boampParse.ts`)
  - Si succès, met à jour `award_criteria`, `offers_received`, `offers_admitted`, `offers_rejected`, `num_candidates`, `subcontracting_share`, `winner_address`, `winner_legal_form`, `winner_country`, `award_date` (si null), `cpv_codes`, `place_of_performance`, `lots_awarded`
  - Ne touche pas à `winner_name`/`winner_siren`/`awarded_amount` s'ils sont déjà remplis (pour ne pas écraser)
- Param `?limit=200&offset=0` pour pagination + renvoie `{ processed, updated, skipped, remaining }`

### 2. Exécution
- Appelle la fonction en boucle (8-9 appels de 200) jusqu'à épuiser les 1660 notices
- Vérifie le résultat final via une query d'agrégat

### 3. Résultat attendu
~1600 notices TED supplémentaires recevront le badge "enriched" dans la liste Awards.

## Détails techniques
- Aucune migration SQL
- Aucun appel externe (pas de re-fetch TED)
- Function `verify_jwt = false`, idempotente (relance possible)
- Le parser actuel marche déjà — démontré par les 405 notices d'aujourd'hui correctement enrichies